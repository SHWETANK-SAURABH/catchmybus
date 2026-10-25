"""ORM models (one class per table in the data model, Section 4 of the spec)."""
from datetime import datetime, time, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="COMMUTER")  # COMMUTER | ADMIN
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Driver(Base):
    __tablename__ = "drivers"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    license_no: Mapped[str] = mapped_column(String(40), unique=True)


class Route(Base):
    __tablename__ = "routes"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    source: Mapped[str] = mapped_column(String(120))
    destination: Mapped[str] = mapped_column(String(120))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    route_stops: Mapped[list["RouteStop"]] = relationship(
        back_populates="route", order_by="RouteStop.seq", cascade="all, delete-orphan"
    )


class BusStop(Base):
    __tablename__ = "bus_stops"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    __table_args__ = (Index("ix_bus_stops_lat_lon", "lat", "lon"),)


class RouteStop(Base):
    """Ordered stop on a route. PK is (route_id, seq) so a loop can start and end at one stop."""

    __tablename__ = "route_stops"
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id", ondelete="CASCADE"), primary_key=True)
    seq: Mapped[int] = mapped_column(Integer, primary_key=True)
    stop_id: Mapped[int] = mapped_column(ForeignKey("bus_stops.id", ondelete="CASCADE"))
    route: Mapped[Route] = relationship(back_populates="route_stops")
    stop: Mapped[BusStop] = relationship()


class Bus(Base):
    __tablename__ = "buses"
    id: Mapped[int] = mapped_column(primary_key=True)
    bus_number: Mapped[str] = mapped_column(String(30), unique=True)
    capacity: Mapped[int] = mapped_column(Integer, default=50)
    driver_id: Mapped[int | None] = mapped_column(ForeignKey("drivers.id", ondelete="SET NULL"), nullable=True)
    # Not in the original table list, but a bus needs to know which route it serves (DECISIONS.md D3).
    route_id: Mapped[int | None] = mapped_column(ForeignKey("routes.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")  # ACTIVE | INACTIVE | MAINTENANCE
    last_gps_sync_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Schedule(Base):
    __tablename__ = "schedules"
    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id", ondelete="CASCADE"))
    stop_id: Mapped[int] = mapped_column(ForeignKey("bus_stops.id", ondelete="CASCADE"))
    departure_time: Mapped[time] = mapped_column(Time)
    arrival_time: Mapped[time] = mapped_column(Time)
    day_of_week: Mapped[int] = mapped_column(Integer)  # 0 = Monday ... 6 = Sunday


class Trip(Base):
    __tablename__ = "trips"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    bus_id: Mapped[int | None] = mapped_column(ForeignKey("buses.id", ondelete="SET NULL"), nullable=True)
    route_id: Mapped[int | None] = mapped_column(ForeignKey("routes.id", ondelete="SET NULL"), nullable=True)
    board_stop_id: Mapped[int | None] = mapped_column(ForeignKey("bus_stops.id", ondelete="SET NULL"), nullable=True)
    alight_stop_id: Mapped[int | None] = mapped_column(ForeignKey("bus_stops.id", ondelete="SET NULL"), nullable=True)
    trip_date: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    status: Mapped[str] = mapped_column(String(20), default="ONGOING")  # ONGOING | COMPLETED


class Favourite(Base):
    __tablename__ = "favourites"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(10))  # ROUTE | STOP
    route_id: Mapped[int | None] = mapped_column(ForeignKey("routes.id", ondelete="CASCADE"), nullable=True)
    stop_id: Mapped[int | None] = mapped_column(ForeignKey("bus_stops.id", ondelete="CASCADE"), nullable=True)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(20))  # ARRIVAL | DELAY | ANNOUNCEMENT | SOS
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)


class AlertSubscription(Base):
    """Backs POST /alerts/subscribe (not in the table list; see DECISIONS.md D5)."""

    __tablename__ = "alert_subscriptions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    bus_id: Mapped[int] = mapped_column(ForeignKey("buses.id", ondelete="CASCADE"))
    stop_id: Mapped[int] = mapped_column(ForeignKey("bus_stops.id", ondelete="CASCADE"))
    minutes_before: Mapped[float] = mapped_column(Float, default=5)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    arrival_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    delay_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Announcement(Base):
    __tablename__ = "announcements"
    id: Mapped[int] = mapped_column(primary_key=True)
    admin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    route_id: Mapped[int | None] = mapped_column(ForeignKey("routes.id", ondelete="SET NULL"), nullable=True)
    message: Mapped[str] = mapped_column(Text)
    posted_on: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class CrowdPrediction(Base):
    __tablename__ = "crowd_predictions"
    id: Mapped[int] = mapped_column(primary_key=True)
    bus_id: Mapped[int] = mapped_column(ForeignKey("buses.id", ondelete="CASCADE"), index=True)
    level: Mapped[str] = mapped_column(String(10))  # LOW | MEDIUM | HIGH
    predicted_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    admin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(20))  # CREATE | UPDATE | DELETE | SIM_DELAY
    entity: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    performed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    details_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class SosAlert(Base):
    __tablename__ = "sos_alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    bus_id: Mapped[int | None] = mapped_column(ForeignKey("buses.id", ondelete="SET NULL"), nullable=True)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    status: Mapped[str] = mapped_column(String(20), default="OPEN")  # OPEN | RESOLVED


class BusPositionHistory(Base):
    __tablename__ = "bus_positions_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    bus_id: Mapped[int] = mapped_column(ForeignKey("buses.id", ondelete="CASCADE"))
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    speed: Mapped[float] = mapped_column(Float)  # km/h
    # Extra columns used by analytics (avg delay / load); see DECISIONS.md D4.
    delay_min: Mapped[float] = mapped_column(Float, default=0.0)
    load: Mapped[int] = mapped_column(Integer, default=0)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    __table_args__ = (Index("ix_bus_history_bus_time", "bus_id", "recorded_at"),)

