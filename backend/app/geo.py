"""Geometry helpers: great-circle distance and positions along a route polyline."""
import math
from bisect import bisect_right

EARTH_RADIUS_M = 6_371_000.0

Point = tuple[float, float]  # (lat, lon)


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres between two lat/lon points (haversine formula).

    a = sin^2(dlat/2) + cos(lat1) * cos(lat2) * sin^2(dlon/2);  d = 2R * asin(sqrt(a))
    """
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = p2 - p1
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial compass bearing (0 = north, 90 = east) from point 1 to point 2."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlon = math.radians(lon2 - lon1)
    x = math.sin(dlon) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def cumulative_distances(points: list[Point]) -> list[float]:
    """Distance from the first point to each vertex along the polyline (first value is 0)."""
    out = [0.0]
    for (a_lat, a_lon), (b_lat, b_lon) in zip(points, points[1:]):
        out.append(out[-1] + haversine_m(a_lat, a_lon, b_lat, b_lon))
    return out


def point_at_distance(points: list[Point], cum: list[float], d: float) -> tuple[Point, float]:
    """Interpolate the (lat, lon) at distance `d` metres along the polyline.

    Returns the point and the heading of the segment it lies on. Linear interpolation
    in lat/lon is accurate enough over the few-hundred-metre segments of a city route.
    """
    if len(points) == 1:
        return points[0], 0.0
    d = max(0.0, min(d, cum[-1]))
    i = min(bisect_right(cum, d) - 1, len(points) - 2)
    seg = cum[i + 1] - cum[i]
    t = 0.0 if seg == 0 else (d - cum[i]) / seg
    (a_lat, a_lon), (b_lat, b_lon) = points[i], points[i + 1]
    pos = (a_lat + (b_lat - a_lat) * t, a_lon + (b_lon - a_lon) * t)
    return pos, bearing_deg(a_lat, a_lon, b_lat, b_lon)
