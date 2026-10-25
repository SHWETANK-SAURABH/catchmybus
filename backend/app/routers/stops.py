"""Stops and route search (FR07, FR08)."""
import math

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..geo import haversine_m
from ..models import BusStop, Route, RouteStop, User
from ..schemas import NearbyStopOut, RouteDetailOut, StopOut
from ..security import get_current_user
from .routes import route_detail

router = APIRouter(tags=["routes"])

METRES_PER_DEG_LAT = 111_320.0


def bounding_box(lat: float, lon: float, radius_m: float) -> tuple[float, float, float, float]:
    """Lat/lon box that contains a circle of `radius_m` (cheap index pre-filter).

    One degree of latitude is ~111.32 km; a degree of longitude shrinks by cos(lat).
    """
    dlat = radius_m / METRES_PER_DEG_LAT
    dlon = radius_m / (METRES_PER_DEG_LAT * max(0.01, math.cos(math.radians(lat))))
    return lat - dlat, lat + dlat, lon - dlon, lon + dlon


def stops_within(db: Session, lat: float, lon: float, radius_m: float) -> list[NearbyStopOut]:
    """Stops within `radius_m` of a point, nearest first (box filter in SQL, exact haversine in Python)."""
    lat0, lat1, lon0, lon1 = bounding_box(lat, lon, radius_m)
    rows = db.scalars(select(BusStop).where(BusStop.lat.between(lat0, lat1), BusStop.lon.between(lon0, lon1))).all()
    out = []
    for s in rows:
        d = haversine_m(lat, lon, s.lat, s.lon)
        if d <= radius_m:
            out.append(NearbyStopOut(id=s.id, name=s.name, lat=s.lat, lon=s.lon, distance_m=round(d, 1)))
    return sorted(out, key=lambda x: x.distance_m)


@router.get("/stops", response_model=list[StopOut])
def list_stops(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.scalars(select(BusStop).order_by(BusStop.name)).all()


@router.get("/stops/nearby", response_model=list[NearbyStopOut])
def nearby_stops(lat: float = Query(ge=-90, le=90), lon: float = Query(ge=-180, le=180),
                 radius_m: float = Query(500, gt=0, le=5000),
                 db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return stops_within(db, lat, lon, radius_m)


def _matches(text: str, *candidates: str) -> bool:
    t = text.strip().lower()
    return bool(t) and any(t in c.lower() for c in candidates)


def find_routes(db: Session, source: str, destination: str) -> list[tuple[Route, RouteStop, RouteStop]]:
    """Routes serving a stop matching `source` and a different stop matching `destination`.

    Matching is a case-insensitive substring of the stop name. Buses run both ways on
    out-and-back routes (and loops come back round), so stop order doesn't matter.
    """
    routes = db.scalars(select(Route).where(Route.active.is_(True)).order_by(Route.id)
                        .options(selectinload(Route.route_stops).selectinload(RouteStop.stop))).all()
    found = []
    for r in routes:
        src = [rs for rs in r.route_stops if _matches(source, rs.stop.name)]
        dst = [rs for rs in r.route_stops if _matches(destination, rs.stop.name)]
        pairs = [(a, b) for a in src for b in dst if a.stop_id != b.stop_id]
        if pairs:
            a, b = min(pairs, key=lambda p: abs(p[0].seq - p[1].seq))
            found.append((r, a, b))
    return found


@router.get("/routes/search", response_model=list[RouteDetailOut])
def search_routes(source: str = Query(min_length=2), destination: str = Query(min_length=2),
                  db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return [route_detail(r) for r, _a, _b in find_routes(db, source, destination)]
