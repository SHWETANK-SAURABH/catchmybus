"""AI & Analytics service: crowd level (FR16), delay (FR18), best route (FR17) and model metrics.

All endpoints honour the `X-Demo-Time: HH:MM` header so the demo can compare 08:30 and 14:00.
"""
import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..cache import cache
from ..clock import effective_time
from ..config import get_settings
from ..db import get_db
from ..geo import haversine_m
from ..ml.best_route import Weights, ride_distance_m, ride_minutes, score_option
from ..ml.predictor import predictor
from ..models import BusStop, User
from ..schemas import BestRouteOut, CrowdOut, DelayOut, RouteOption, ScoreBreakdown, StopOut
from ..security import get_current_user
from ..services.eta import eta_for
from ..services.route_geometry import load_geometries
from .stops import find_routes, stops_within

router = APIRouter(prefix="/ai", tags=["ai"])

WEATHER = {"clear": 1.0, "rain": 1.3}
WALK_RADIUS_M = 800  # alternative boarding stops considered around the chosen source


def _sim_bus(bus_id: int):
    from ..simulator import simulator

    st = simulator.buses.get(bus_id)
    if st is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bus is not live")
    return st


def crowd_for_bus(bus_id: int, when: datetime, weather: float = 1.0) -> CrowdOut:
    st = _sim_bus(bus_id)
    seq = next((s.seq for s in st.geom.stops if s.stop_id == st.next_stop_id), 0)
    level, probs, source = predictor.crowd(when.hour, when.weekday(), st.route_id, seq, weather)
    return CrowdOut(bus_id=bus_id, level=level, probabilities=probs, hour=when.hour, source=source)


@router.get("/crowd", response_model=CrowdOut)
def crowd(bus_id: int, weather: str = Query("clear", pattern="^(clear|rain)$"),
          when: datetime = Depends(effective_time), _: User = Depends(get_current_user)):
    return crowd_for_bus(bus_id, when, WEATHER[weather])


@router.get("/crowd/all", response_model=list[CrowdOut])
def crowd_all(weather: str = Query("clear", pattern="^(clear|rain)$"),
              when: datetime = Depends(effective_time), _: User = Depends(get_current_user)):
    """Crowd level for every live bus in one call (map badges)."""
    from ..simulator import simulator

    return [crowd_for_bus(b, when, WEATHER[weather]) for b in list(simulator.buses)]


@router.get("/delay", response_model=DelayOut)
def delay(bus_id: int, stop_id: int | None = None, when: datetime = Depends(effective_time),
          _: User = Depends(get_current_user)):
    """Predicted delay to a stop (or to the end of the current run if no stop is given)."""
    st = _sim_bus(bus_id)
    snap = cache.get_position(bus_id) or {}
    hold = snap.get("delay_min", 0.0)
    if stop_id is not None:
        res = eta_for(bus_id, stop_id, when)
        if res is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Stop is not on this bus's route")
        pred, source = res.predicted_delay_min, res.delay_source
    else:
        remaining = st.geom.length_m - st.s if st.direction > 0 else st.s
        pred, source = predictor.delay(when.hour, when.weekday(), st.route_id, remaining, st.speed_ema)
    pred = round(pred, 2)
    return DelayOut(bus_id=bus_id, stop_id=stop_id, predicted_delay_min=pred, injected_delay_min=hold,
                    total_delay_min=round(pred + hold, 2), source=source)


@router.get("/best-route", response_model=BestRouteOut)
def best_route(source: str = Query(min_length=2), destination: str = Query(min_length=2),
               w_eta: float | None = None, w_walk: float | None = None,
               w_crowd: float | None = None, w_delay: float | None = None,
               when: datetime = Depends(effective_time), db: Session = Depends(get_db),
               _: User = Depends(get_current_user)):
    """Rank direct bus options between two places, with a per-term score breakdown.

    Boarding at a stop near the source (within 800 m) is allowed and costs walking.
    """
    from ..simulator import simulator

    s = get_settings()
    w = Weights(w_eta if w_eta is not None else s.w_eta, w_walk if w_walk is not None else s.w_walk,
                w_crowd if w_crowd is not None else s.w_crowd, w_delay if w_delay is not None else s.w_delay_risk)

    matches = [st for st in db.query(BusStop).all() if source.lower() in st.name.lower()]
    src_stop = min(matches, key=lambda st: st.name.lower() != source.lower(), default=None)  # exact name first
    if src_stop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source stop not found")
    nearby = {n.id: n for n in stops_within(db, src_stop.lat, src_stop.lon, WALK_RADIUS_M)}
    geoms = load_geometries(db)

    options: list[RouteOption] = []
    for board in nearby.values():
        for route, rs_board, rs_alight in find_routes(db, board.name, destination):
            g = geoms.get(route.id)
            if g is None:
                continue
            walk = haversine_m(src_stop.lat, src_stop.lon, board.lat, board.lon)
            ride_m = min(ride_distance_m(a, b, g.length_m, g.is_loop)
                         for a in g.stop_distances(rs_board.stop_id) for b in g.stop_distances(rs_alight.stop_id))
            # Pick the live bus on this route that reaches the boarding stop first.
            best_bus, best_eta = None, None
            for bus_id, st in list(simulator.buses.items()):
                if st.route_id != route.id:
                    continue
                res = eta_for(bus_id, rs_board.stop_id, when)
                if res and (best_eta is None or res.eta_minutes < best_eta.eta_minutes):
                    best_bus, best_eta = st, res
            crowd_level = crowd_for_bus(best_bus.bus_id, when).level if best_bus else None
            pred_delay, _src = predictor.delay(when.hour, when.weekday(), route.id, ride_m,
                                               best_bus.speed_ema if best_bus else 20.0)
            delay_total = pred_delay + (best_eta.hold_min if best_eta else 0.0)
            score, breakdown = score_option(best_eta.eta_minutes if best_eta else None, ride_minutes(ride_m),
                                            walk, crowd_level, delay_total, w)
            options.append(RouteOption(
                route_id=route.id, route_name=route.name,
                bus_id=best_bus.bus_id if best_bus else None, bus_number=best_bus.bus_number if best_bus else None,
                board_stop=StopOut(id=board.id, name=board.name, lat=board.lat, lon=board.lon),
                alight_stop=StopOut.model_validate(rs_alight.stop), walk_m=round(walk, 1),
                eta_minutes=best_eta.eta_minutes if best_eta else None, crowd_level=crowd_level,
                predicted_delay_min=round(delay_total, 2), score=score, breakdown=ScoreBreakdown(**breakdown)))

    # Keep the best option per (route, boarding stop) and sort by score.
    options.sort(key=lambda o: o.score)
    seen, unique = set(), []
    for o in options:
        if (o.route_id, o.board_stop.id) not in seen:
            seen.add((o.route_id, o.board_stop.id))
            unique.append(o)
    return BestRouteOut(source=source, destination=destination,
                        weights={"eta": w.eta, "walk": w.walk, "crowd": w.crowd, "delay_risk": w.delay_risk},
                        options=unique[:6])


@router.get("/metrics")
def metrics(_: User = Depends(get_current_user)):
    """Evaluation metrics of the trained models (synthetic test split)."""
    path = Path(get_settings().models_dir) / "metrics.json"
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Models not trained yet - run `make train`")
    return json.loads(path.read_text())
