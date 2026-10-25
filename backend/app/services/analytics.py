"""Admin analytics (FR33): aggregates computed in Python so they work on SQLite and Postgres."""
from collections import Counter, defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..clock import to_local
from ..models import Bus, BusPositionHistory, CrowdPrediction, Route, SosAlert, Trip, utcnow


def analytics(db: Session, days: int = 14) -> dict:
    since: datetime = utcnow() - timedelta(days=days)
    routes = {r.id: r.name for r in db.scalars(select(Route)).all()}

    trips = db.execute(select(Trip.route_id, Trip.trip_date).where(Trip.trip_date >= since)).all()
    by_route = Counter(rid for rid, _ in trips if rid is not None)
    by_hour = Counter(to_local(ts).hour for _, ts in trips)  # stored UTC -> IST hour

    delays = db.execute(
        select(Bus.route_id, func.avg(BusPositionHistory.delay_min), func.count())
        .join(Bus, Bus.id == BusPositionHistory.bus_id)
        .where(BusPositionHistory.recorded_at >= since, Bus.route_id.is_not(None))
        .group_by(Bus.route_id)
    ).all()

    crowd = Counter(dict(db.execute(
        select(CrowdPrediction.level, func.count()).where(CrowdPrediction.predicted_at >= since)
        .group_by(CrowdPrediction.level)).all()))

    sos = defaultdict(int, dict(db.execute(select(SosAlert.status, func.count()).group_by(SosAlert.status)).all()))

    return {
        "days": days,
        "total_trips": len(trips),
        "ridership_by_route": [{"route_id": rid, "route": routes.get(rid, f"#{rid}"), "trips": by_route.get(rid, 0)}
                               for rid in sorted(routes)],
        "ridership_by_hour": [{"hour": h, "trips": by_hour.get(h, 0)} for h in range(5, 24)],
        "avg_delay_by_route": [{"route_id": rid, "route": routes.get(rid, f"#{rid}"),
                                "avg_delay_min": round(float(avg or 0), 2), "samples": n}
                               for rid, avg, n in sorted(delays)],
        "crowd_distribution": [{"level": lv, "count": crowd.get(lv, 0)} for lv in ("LOW", "MEDIUM", "HIGH")],
        "sos": {"total": sum(sos.values()), "open": sos["OPEN"], "resolved": sos["RESOLVED"]},
    }
