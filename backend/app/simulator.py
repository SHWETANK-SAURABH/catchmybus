"""GPS simulator: moves buses along their route polylines and publishes positions.

Runs as a background asyncio task inside the API, or standalone:
    python -m app.simulator
Every tick (default 2 s) each bus:
  * accelerates towards a randomly drifting cruise speed (15-35 km/h),
  * stops and dwells at every bus stop it reaches, updating its passenger load,
  * turns around at the end of the route (or wraps round, for a loop route).
Delays: random events drop the speed to 30% for 2-4 minutes (slow traffic); the admin
"simulate delay" control holds the bus still for N minutes (an incident/jam).
Positions go to the cache and out over WebSocket; history is stored every ~10 s.
"""
import asyncio
import logging
import random
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select

from .cache import ICache, cache
from .clock import now_local
from .config import get_settings
from .db import SessionLocal
from .ml import patterns
from .models import Bus, BusPositionHistory
from .services.hub import hub
from .services.route_geometry import RouteGeometry, load_geometries

log = logging.getLogger("catchmybus.sim")

MIN_SPEED_KMH, MAX_SPEED_KMH = 15.0, 35.0
SLOWDOWN_FACTOR = 0.3  # speed multiplier during a delay event
SPEED_EMA_ALPHA = 0.05  # smoothing for "recent speed" (time constant ~40 s at 2 s ticks)


@dataclass
class BusState:
    bus_id: int
    bus_number: str
    route_id: int
    capacity: int
    geom: RouteGeometry
    s: float = 0.0  # distance travelled from the route start, metres
    direction: int = 1  # +1 outbound, -1 inbound (loops are always +1)
    speed_kmh: float = 0.0
    cruise_kmh: float = 25.0
    speed_ema: float = 20.0  # smoothed speed including stops, used for ETA
    dwell_left: float = 0.0  # seconds left standing at the current stop
    slow_left: float = 0.0  # seconds left in a random slow-traffic event
    hold_left: float = 0.0  # seconds left of a manual delay (bus held still)
    load: int = 0
    lat: float = 0.0
    lon: float = 0.0
    heading: float = 0.0
    next_stop_id: int | None = None

    def snapshot(self) -> dict:
        return {
            "bus_id": self.bus_id, "bus_number": self.bus_number, "route_id": self.route_id,
            "lat": round(self.lat, 6), "lon": round(self.lon, 6), "heading": round(self.heading, 1),
            "speed_kmh": round(self.speed_kmh, 1), "delay_min": round(self.hold_left / 60, 1),
            "load": self.load, "capacity": self.capacity, "next_stop_id": self.next_stop_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            # internal fields used by the ETA service
            "s": self.s, "direction": self.direction, "speed_ema": self.speed_ema,
        }


def public_snapshot(snap: dict) -> dict:
    """Strip the internal fields before sending a snapshot to clients."""
    return {k: v for k, v in snap.items() if k not in ("s", "direction", "speed_ema")}


class Simulator:
    def __init__(self, cache_: ICache, seed: int | None = 7):
        self.cache = cache_
        self.rng = random.Random(seed)
        self.buses: dict[int, BusState] = {}
        self.geometries: dict[int, RouteGeometry] = {}
        self.lock = threading.Lock()  # tick() runs on the loop; admin reloads run in worker threads
        self.listeners = []  # async callables run after every tick (e.g. alert engine)

    # ---------------- loading ----------------
    def sync_with_db(self, db=None):
        """(Re)load routes and active buses from the database, keeping existing bus progress."""
        own = db is None
        db = db or SessionLocal()
        try:
            geoms = load_geometries(db)
            rows = db.scalars(select(Bus).where(Bus.status == "ACTIVE")).all()
        finally:
            if own:
                db.close()
        with self.lock:
            self.geometries = geoms
            wanted = {b.id: b for b in rows if b.route_id in geoms}
            for bid in list(self.buses):
                if bid not in wanted:
                    del self.buses[bid]
            per_route: dict[int, int] = {}
            for b in sorted(wanted.values(), key=lambda x: x.id):
                g = geoms[b.route_id]
                k = per_route.get(b.route_id, 0)
                per_route[b.route_id] = k + 1
                st = self.buses.get(b.id)
                if st is None or st.route_id != b.route_id:
                    # Spread buses of one route out and alternate their direction.
                    st = BusState(b.id, b.bus_number, b.route_id, b.capacity, g,
                                  s=g.length_m * ((k * 0.45) % 1.0),
                                  direction=1 if (k % 2 == 0 or g.is_loop) else -1,
                                  cruise_kmh=self.rng.uniform(20, 30))
                    now = now_local()
                    st.load = int(patterns.load_fraction(now.hour, now.weekday(), b.route_id, 2) * b.capacity)
                    self.buses[b.id] = st
                st.geom, st.bus_number, st.capacity = g, b.bus_number, b.capacity
                st.s = min(st.s, g.length_m)
                self._update_position(st)
        for st in self.buses.values():
            self.cache.set_position(st.bus_id, st.snapshot())
        for p in self.cache.all_positions():
            if p["bus_id"] not in self.buses:
                self.cache.remove(p["bus_id"])  # bus deleted or deactivated
        log.info("simulator loaded", extra={"fields": {"buses": len(self.buses), "routes": len(geoms)}})

    # ---------------- control ----------------
    def inject_delay(self, bus_id: int, minutes: float) -> bool:
        """Hold a bus where it is for `minutes` real minutes (demo control; 0 clears it)."""
        with self.lock:
            st = self.buses.get(bus_id)
            if not st:
                return False
            st.hold_left = float(minutes) * 60.0
            st.speed_kmh = 0.0
            self.cache.set_position(bus_id, st.snapshot())
            return True

    # ---------------- physics ----------------
    def tick(self, dt: float):
        """Advance every bus by `dt` seconds of simulated time."""
        s = get_settings()
        now = now_local()
        with self.lock:
            for st in self.buses.values():
                if s.sim_random_delays and st.slow_left <= 0 and self.rng.random() < dt / 3600.0:
                    st.slow_left = self.rng.uniform(120, 240)  # ~1 slow-traffic event per bus-hour
                    log.info("random delay event", extra={"fields": {"bus_id": st.bus_id,
                                                                     "seconds": round(st.slow_left)}})
                if st.hold_left > 0:  # manual delay: bus stuck, recent-speed estimate frozen
                    st.hold_left = max(0.0, st.hold_left - dt)
                    st.speed_kmh = 0.0
                    self._update_position(st)
                    self.cache.set_position(st.bus_id, st.snapshot())
                    continue
                if st.dwell_left > 0:
                    st.dwell_left -= dt
                    st.speed_kmh = 0.0
                else:
                    st.cruise_kmh = min(MAX_SPEED_KMH, max(MIN_SPEED_KMH, st.cruise_kmh + self.rng.gauss(0, 1.5)))
                    target = st.cruise_kmh * (SLOWDOWN_FACTOR if st.slow_left > 0 else 1.0)
                    st.speed_kmh += (target - st.speed_kmh) * 0.5  # smooth acceleration
                    self._advance(st, st.speed_kmh / 3.6 * dt * s.sim_speed_multiplier, now)
                st.slow_left = max(0.0, st.slow_left - dt)
                st.speed_ema = (1 - SPEED_EMA_ALPHA) * st.speed_ema + SPEED_EMA_ALPHA * st.speed_kmh
                self._update_position(st)
                self.cache.set_position(st.bus_id, st.snapshot())

    def _advance(self, st: BusState, step_m: float, now: datetime):
        """Move a bus `step_m` metres, stopping at the first bus stop it reaches."""
        g, old = st.geom, st.s
        new = old + st.direction * step_m
        if st.direction > 0:
            crossed = [x for x in g.stops if old < x.distance_m <= new]
            hit = min(crossed, key=lambda x: x.distance_m) if crossed else None
        else:
            crossed = [x for x in g.stops if new <= x.distance_m < old]
            hit = max(crossed, key=lambda x: x.distance_m) if crossed else None

        if hit is None:
            st.s = min(max(new, 0.0), g.length_m)
            return
        st.s = hit.distance_m
        mult = get_settings().sim_speed_multiplier
        terminal = hit.distance_m in (0.0, g.length_m)
        st.dwell_left = (30.0 if terminal else self.rng.uniform(8, 20)) / mult
        st.speed_kmh = 0.0
        # Passengers board/alight: move load half-way towards the time-of-day expectation.
        frac = patterns.load_fraction(now.hour, now.weekday(), st.route_id, hit.seq)
        target = frac * st.capacity * self.rng.uniform(0.85, 1.15)
        st.load = int(min(1.3 * st.capacity, max(0, 0.5 * st.load + 0.5 * target)))
        if terminal:
            if g.is_loop:
                st.s = 0.0
            else:
                st.direction = -1 if hit.distance_m >= g.length_m else 1

    def _update_position(self, st: BusState):
        (lat, lon), heading = st.geom.position_at(st.s)
        st.lat, st.lon = lat, lon
        st.heading = heading if st.direction > 0 else (heading + 180) % 360
        st.next_stop_id = self._next_stop(st)

    @staticmethod
    def _next_stop(st: BusState) -> int | None:
        stops = st.geom.stops
        if st.direction > 0:
            ahead = [x for x in stops if x.distance_m > st.s]
            if ahead:
                return ahead[0].stop_id
            return stops[1].stop_id if st.geom.is_loop and len(stops) > 1 else stops[-1].stop_id
        behind = [x for x in stops if x.distance_m < st.s]
        return behind[-1].stop_id if behind else stops[0].stop_id

    # ---------------- persistence ----------------
    def write_history(self):
        """Store one history row per bus and stamp buses.last_gps_sync_at."""
        with self.lock:
            snaps = [(st.bus_id, st.lat, st.lon, st.speed_kmh, round(st.hold_left / 60, 2), st.load)
                     for st in self.buses.values()]
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        with SessionLocal() as db:
            for bus_id, lat, lon, speed, delay, load in snaps:
                db.add(BusPositionHistory(bus_id=bus_id, lat=lat, lon=lon, speed=round(speed, 1),
                                          delay_min=delay, load=load, recorded_at=now))
                bus = db.get(Bus, bus_id)
                if bus:
                    bus.last_gps_sync_at = now
            db.commit()

    # ---------------- main loop ----------------
    async def run(self, broadcast: bool = True):
        s = get_settings()
        await asyncio.to_thread(self.sync_with_db)
        last_hist = last_sync = time.monotonic()
        while True:
            started = time.monotonic()
            try:
                self.tick(s.sim_tick_seconds)
                if broadcast:
                    with self.lock:
                        buses = [public_snapshot(st.snapshot()) for st in self.buses.values()]
                    await hub.broadcast_tracking({"type": "positions", "buses": buses})
                if started - last_hist >= s.sim_history_every_seconds:
                    last_hist = started
                    await asyncio.to_thread(self.write_history)
                if started - last_sync >= 15:  # pick up admin/seed changes
                    last_sync = started
                    await asyncio.to_thread(self.sync_with_db)
                for listener in self.listeners:
                    await listener(self)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("simulator tick failed")
            await asyncio.sleep(max(0.0, s.sim_tick_seconds - (time.monotonic() - started)))


simulator = Simulator(cache)


if __name__ == "__main__":
    # Standalone mode: move buses and write history to the DB without the API.
    from .db import init_db
    from .logging_conf import setup_logging

    setup_logging()
    init_db()

    async def _main():
        async def report(sim: Simulator):
            for st in list(sim.buses.values())[:3]:
                print(f"{st.bus_number}: ({st.lat:.5f}, {st.lon:.5f}) {st.speed_kmh:4.1f} km/h load={st.load}")

        simulator.listeners.append(report)
        await simulator.run(broadcast=False)

    try:
        asyncio.run(_main())
    except KeyboardInterrupt:
        pass
