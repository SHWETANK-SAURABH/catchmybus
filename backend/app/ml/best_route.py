"""Best-route suggestion (FR17): rank direct options with an explainable weighted score.

    score = w_eta * (wait + ride minutes)
          + w_walk * walking metres to the boarding stop
          + w_crowd * crowd penalty   (LOW 0, MEDIUM 1, HIGH 2.5)
          + w_delay * predicted delay minutes
Lower is better. Every term is returned so the UI can explain the ranking.
"""
from dataclasses import dataclass

CROWD_PENALTY = {"LOW": 0.0, "MEDIUM": 1.0, "HIGH": 2.5}
RIDE_SPEED_KMH = 20.0  # planning speed for the in-bus part of the trip
NO_BUS_WAIT_MIN = 30.0  # assumed wait when no live bus serves the route right now


@dataclass
class Weights:
    eta: float
    walk: float
    crowd: float
    delay_risk: float


def ride_distance_m(board_d: float, alight_d: float, length: float, is_loop: bool) -> float:
    """Distance travelled on the bus between two stops of a route.

    Loops only run forward, so it is (alight - board) mod length; out-and-back routes run
    both ways, so it is the absolute difference.
    """
    if is_loop:
        return (alight_d - board_d) % length if length else 0.0
    return abs(alight_d - board_d)


def ride_minutes(distance_m: float) -> float:
    """Minutes on board at the planning speed RIDE_SPEED_KMH."""
    return distance_m / (RIDE_SPEED_KMH / 3.6) / 60.0


def score_option(wait_min: float | None, ride_min: float, walk_m: float, crowd_level: str | None,
                 delay_min: float, w: Weights) -> tuple[float, dict[str, float]]:
    """Weighted score (lower = better) and the contribution of each term."""
    wait = NO_BUS_WAIT_MIN if wait_min is None else wait_min
    breakdown = {
        "eta": round(w.eta * (wait + ride_min), 2),
        "walk": round(w.walk * walk_m, 2),
        "crowd": round(w.crowd * CROWD_PENALTY.get(crowd_level or "LOW", 0.0), 2),
        "delay_risk": round(w.delay_risk * delay_min, 2),
    }
    return round(sum(breakdown.values()), 2), breakdown
