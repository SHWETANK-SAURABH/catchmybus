"""Reset the database and load demo data from seed/*.json.

Run with `python -m app.seed` (or `make seed`). Demo passwords come from the environment
(SEED_ADMIN_PASSWORD / SEED_COMMUTER_PASSWORD), never from source code.
"""
import json
import logging
import random
import sys
from datetime import datetime, time, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from .clock import now_local, to_utc
from .config import get_settings
from .db import Base, SessionLocal, engine
from .geo import cumulative_distances
from .ml import patterns
from .models import (
    Bus,
    BusPositionHistory,
    BusStop,
    CrowdPrediction,
    Driver,
    Route,
    RouteStop,
    Schedule,
    Trip,
    User,
)
from .security import hash_password

log = logging.getLogger("catchmybus.seed")


def _load(name: str) -> dict:
    return json.loads((Path(get_settings().seed_dir) / name).read_text(encoding="utf-8"))


def seed(db: Session, with_history: bool = True) -> dict:
    """Insert demo users, stops, routes, fleet, schedules and some past activity."""
    s = get_settings()
    if not s.seed_admin_password or not s.seed_commuter_password:
        raise RuntimeError("Set SEED_ADMIN_PASSWORD and SEED_COMMUTER_PASSWORD in .env before seeding")
    rng = random.Random(42)

    admin = User(name="Admin", email=s.seed_admin_email, role="ADMIN",
                 password_hash=hash_password(s.seed_admin_password))
    arun = User(name="Arun", email=s.seed_commuter_email, phone="9876543210", role="COMMUTER",
                password_hash=hash_password(s.seed_commuter_password))
    db.add_all([admin, arun])

    stops = {}
    for st in _load("stops.json")["stops"]:
        stops[st["key"]] = BusStop(name=st["name"], lat=st["lat"], lon=st["lon"])
    db.add_all(stops.values())

    routes = []
    for r in _load("routes.json")["routes"]:
        route = Route(name=r["name"], source=r["source"], destination=r["destination"], active=True)
        route.route_stops = [RouteStop(seq=i, stop=stops[k]) for i, k in enumerate(r["stops"])]
        routes.append(route)
    db.add_all(routes)

    fleet = _load("fleet.json")
    drivers = [Driver(**d) for d in fleet["drivers"]]
    db.add_all(drivers)
    db.flush()
    buses = []
    for b in fleet["buses"]:
        buses.append(Bus(bus_number=b["bus_number"], capacity=b["capacity"],
                         driver_id=drivers[b["driver_index"]].id,
                         route_id=routes[b["route_index"]].id, status="ACTIVE"))
    db.add_all(buses)
    db.flush()

    # Timetable: hourly departures 06:00-21:00 every day, 25 km/h planning speed + 30 s dwell.
    n_sched = 0
    for route in routes:
        pts = [(rs.stop.lat, rs.stop.lon) for rs in route.route_stops]
        cum = cumulative_distances(pts)
        for dow in range(7):
            for hour in range(6, 22):
                for rs, d in zip(route.route_stops, cum):
                    offset = timedelta(seconds=d / (25 / 3.6) + 30 * rs.seq)
                    arr = datetime.combine(datetime.today(), time(hour)) + offset
                    dep = arr + timedelta(seconds=30)
                    db.add(Schedule(route_id=route.id, stop_id=rs.stop.id, day_of_week=dow,
                                    arrival_time=arr.time().replace(microsecond=0),
                                    departure_time=dep.time().replace(microsecond=0)))
                    n_sched += 1

    n_trips = 0
    if with_history:
        n_trips = _seed_past_activity(db, rng, arun, routes, buses)
    db.commit()
    return {"users": 2, "stops": len(stops), "routes": len(routes), "buses": len(buses),
            "drivers": len(drivers), "schedules": n_sched, "past_trips": n_trips}


def _seed_past_activity(db: Session, rng: random.Random, user: User, routes, buses) -> int:
    """Two weeks of synthetic trips, delays and crowd readings so the analytics charts
    have something to show on a fresh install. Clearly synthetic (see README)."""
    now = now_local().replace(minute=0, second=0, microsecond=0)  # patterns use local hours; stored as UTC
    bus_by_route = {r.id: [b for b in buses if b.route_id == r.id] for r in routes}
    n = 0
    for day in range(14, 0, -1):
        date = now - timedelta(days=day)
        dow = date.weekday()
        for hour in range(6, 23):
            for route in routes:
                demand = patterns.hourly_demand(hour, dow) * patterns.route_popularity(route.id)
                stops = route.route_stops
                bus = rng.choice(bus_by_route[route.id])
                # Ridership: number of trips this hour scales with demand.
                for _ in range(int(demand * 6 + rng.random())):
                    board = rng.randrange(0, len(stops) - 1)
                    alight = rng.randrange(board + 1, len(stops))
                    db.add(Trip(user_id=user.id, bus_id=bus.id, route_id=route.id,
                                board_stop_id=stops[board].stop_id, alight_stop_id=stops[alight].stop_id,
                                trip_date=to_utc(date.replace(hour=hour, minute=rng.randrange(60))),
                                status="COMPLETED"))
                    n += 1
                # One position/delay sample and crowd reading per bus-hour.
                frac = patterns.load_fraction(hour, dow, route.id, 3) + rng.gauss(0, 0.08)
                delay = patterns.expected_delay(hour, dow, route.id, 3000, 20, rng.uniform(0.9, 1.4))
                st = stops[rng.randrange(len(stops))].stop
                ts = to_utc(date.replace(hour=hour, minute=30))
                db.add(BusPositionHistory(bus_id=bus.id, lat=st.lat, lon=st.lon, speed=20.0,
                                          delay_min=round(max(0, delay + rng.gauss(0, 1)), 2),
                                          load=int(max(0, frac) * bus.capacity), recorded_at=ts))
                db.add(CrowdPrediction(bus_id=bus.id, level=patterns.crowd_level(frac), predicted_at=ts))
    return n


def reset_and_seed() -> dict:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        return seed(db)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    try:
        result = reset_and_seed()
    except RuntimeError as e:
        print(f"Seed failed: {e}", file=sys.stderr)
        sys.exit(1)
    print("Seeded:", json.dumps(result))
