"""Route & Trip service: route list/detail (search and nearby stops are added in Phase 3)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..models import Route, RouteStop, User
from ..schemas import RouteDetailOut, RouteOut, RouteStopOut, StopOut
from ..security import get_current_user
from ..services.route_geometry import build_geometry

router = APIRouter(tags=["routes"])


def route_detail(route: Route) -> RouteDetailOut:
    g = build_geometry(route)
    stops = [RouteStopOut(seq=s.seq, distance_m=round(s.distance_m, 1),
                          stop=StopOut(id=s.stop_id, name=s.name, lat=s.lat, lon=s.lon)) for s in g.stops]
    return RouteDetailOut(id=route.id, name=route.name, source=route.source, destination=route.destination,
                          active=route.active, stops=stops, polyline=g.points, length_m=round(g.length_m, 1),
                          is_loop=g.is_loop)


@router.get("/routes", response_model=list[RouteOut])
def list_routes(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.scalars(select(Route).where(Route.active.is_(True)).order_by(Route.id)).all()


@router.get("/routes/all/detail", response_model=list[RouteDetailOut])
def all_route_details(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Every active route with stops and polyline, so the map can draw them in one call."""
    stmt = (select(Route).where(Route.active.is_(True)).order_by(Route.id)
            .options(selectinload(Route.route_stops).selectinload(RouteStop.stop)))
    return [route_detail(r) for r in db.scalars(stmt).all()]


@router.get("/routes/{route_id}", response_model=RouteDetailOut)
def get_route(route_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    route = db.scalar(select(Route).where(Route.id == route_id)
                      .options(selectinload(Route.route_stops).selectinload(RouteStop.stop)))
    if route is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Route not found")
    return route_detail(route)
