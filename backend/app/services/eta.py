"""ETA service (FR09): how long until a bus reaches a stop.

ETA = travel time + remaining manual hold + share of the predicted delay still ahead, where
  travel time = distance still to drive along the route / smoothed recent speed
"""
from dataclasses import dataclass
from datetime import datetime

from ..cache import cache
from ..config import get_settings
from ..ml.predictor import predictor
from .route_geometry import RouteGeometry

MIN_ETA_SPEED_KMH = 8.0  # floor so a briefly stopped bus doesn't produce an infinite ETA


def remaining_distance_m(s: float, direction: int, length: float, stop_d: float, is_loop: bool) -> float:
    """Distance (m) a bus at position `s` must still drive to reach a stop at `stop_d`.

    * Loop routes always run forward and wrap: (stop_d - s) mod length.
    * Out-and-back routes: if the stop is ahead in the current direction it is the
      straight difference; otherwise the bus drives to the terminus and back.
    """
    if length <= 0:
        return 0.0
    if is_loop:
        return (stop_d - s) % length
    if direction > 0:
        return stop_d - s if stop_d >= s else (length - s) + (length - stop_d)
    return s - stop_d if stop_d <= s else s + stop_d


def travel_minutes(distance_m: float, speed_kmh: float, speed_multiplier: float = 1.0) -> float:
    """Minutes to cover `distance_m` at `speed_kmh` (floored at MIN_ETA_SPEED_KMH).

    `speed_multiplier` matches the simulator's time compression (1 = real time).
    """
    speed_ms = max(speed_kmh, MIN_ETA_SPEED_KMH) / 3.6 * speed_multiplier
    return distance_m / speed_ms / 60.0


def confidence_score(distance_m: float, speed_kmh: float, hold_min: float) -> float:
    """Heuristic confidence in [0.3, 0.95]: lower for far-away stops, crawling buses or holds.

    Starts at 0.95, loses 0.05 per km of distance (max 0.4), 0.15 when the smoothed
    speed is below 12 km/h, and 0.1 while the bus is held by an incident.
    """
    c = 0.95 - min(0.4, 0.05 * distance_m / 1000.0)
    if speed_kmh < 12:
        c -= 0.15
    if hold_min > 0:
        c -= 0.1
    return round(max(0.3, c), 2)


@dataclass
class EtaResult:
    eta_minutes: float
    distance_m: float
    smoothed_speed_kmh: float
    predicted_delay_min: float  # model output for the rest of the trip (nominal minutes)
    hold_min: float  # manual delay still to elapse
    confidence: float
    delay_source: str

    @property
    def total_delay_min(self) -> float:
        return self.predicted_delay_min + self.hold_min


def compute_eta(snap: dict, geom: RouteGeometry, stop_id: int, when: datetime) -> EtaResult | None:
    """ETA for the bus in `snap` (a cache snapshot) to `stop_id`; None if not on its route."""
    dists = geom.stop_distances(stop_id)
    if not dists or "s" not in snap:
        return None
    mult = get_settings().sim_speed_multiplier
    remaining = min(remaining_distance_m(snap["s"], snap["direction"], geom.length_m, d, geom.is_loop)
                    for d in dists)
    speed = snap["speed_ema"]
    hold = snap.get("delay_min", 0.0)
    pred, source = predictor.delay(when.hour, when.weekday(), geom.route_id, remaining, speed)
    # The model predicts delay for the remaining distance; scale to real time like travel.
    eta = travel_minutes(remaining, speed, mult) + hold + pred / mult
    return EtaResult(round(eta, 2), round(remaining, 1), round(speed, 1), round(pred, 2), round(hold, 2),
                     confidence_score(remaining, speed, hold), source)


def eta_for(bus_id: int, stop_id: int, when: datetime) -> EtaResult | None:
    """Look the bus up in the cache/simulator and compute its ETA to a stop."""
    from ..simulator import simulator

    snap = cache.get_position(bus_id)
    st = simulator.buses.get(bus_id)
    if not snap or st is None:
        return None
    return compute_eta(snap, st.geom, stop_id, when)
