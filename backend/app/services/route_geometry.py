"""Turns a route's ordered stops into a measurable polyline (used by simulator, ETA, API)."""
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..geo import Point, cumulative_distances, point_at_distance
from ..models import Route, RouteStop


@dataclass
class StopOnRoute:
    seq: int
    stop_id: int
    name: str
    lat: float
    lon: float
    distance_m: float  # distance from the start of the route


@dataclass
class RouteGeometry:
    route_id: int
    name: str
    points: list[Point]
    cum: list[float]
    stops: list[StopOnRoute] = field(default_factory=list)

    @property
    def length_m(self) -> float:
        return self.cum[-1] if self.cum else 0.0

    @property
    def is_loop(self) -> bool:
        """A route whose first and last stop are the same is driven as a loop."""
        return len(self.stops) > 2 and self.stops[0].stop_id == self.stops[-1].stop_id

    def position_at(self, d: float) -> tuple[Point, float]:
        return point_at_distance(self.points, self.cum, d)

    def stop_distances(self, stop_id: int) -> list[float]:
        """All distances along the route where `stop_id` appears (a loop may list it twice)."""
        return [s.distance_m for s in self.stops if s.stop_id == stop_id]


def build_geometry(route: Route) -> RouteGeometry:
    """Build geometry from a Route with its `route_stops` (and their stops) loaded."""
    rs = sorted(route.route_stops, key=lambda x: x.seq)
    points = [(r.stop.lat, r.stop.lon) for r in rs]
    cum = cumulative_distances(points) if points else []
    stops = [StopOnRoute(r.seq, r.stop_id, r.stop.name, r.stop.lat, r.stop.lon, d) for r, d in zip(rs, cum)]
    return RouteGeometry(route.id, route.name, points, cum, stops)


def load_geometries(db: Session, active_only: bool = True) -> dict[int, RouteGeometry]:
    stmt = select(Route).options(selectinload(Route.route_stops).selectinload(RouteStop.stop))
    if active_only:
        stmt = stmt.where(Route.active.is_(True))
    return {r.id: build_geometry(r) for r in db.scalars(stmt).all() if len(r.route_stops) >= 2}
