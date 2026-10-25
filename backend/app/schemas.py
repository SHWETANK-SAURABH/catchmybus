"""Pydantic v2 request/response schemas shared by the routers."""
from datetime import datetime, time
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

T = TypeVar("T")


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int


# ---------- Auth ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=20)
    password: str = Field(min_length=6, max_length=72)  # bcrypt uses at most 72 bytes


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORM):
    id: int
    name: str
    email: str
    phone: str | None
    role: str
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Core entities ----------
class StopOut(ORM):
    id: int
    name: str
    lat: float
    lon: float


class RouteOut(ORM):
    id: int
    name: str
    source: str
    destination: str
    active: bool


class RouteStopOut(BaseModel):
    seq: int
    stop: StopOut
    distance_m: float  # distance from the start of the route along the polyline


class RouteDetailOut(RouteOut):
    stops: list[RouteStopOut]
    polyline: list[tuple[float, float]]
    length_m: float
    is_loop: bool


class BusOut(ORM):
    id: int
    bus_number: str
    capacity: int
    driver_id: int | None
    route_id: int | None
    status: str
    last_gps_sync_at: datetime | None


class BusLocationOut(BaseModel):
    bus_id: int
    bus_number: str
    route_id: int
    lat: float
    lon: float
    heading: float
    speed_kmh: float
    delay_min: float
    load: int
    capacity: int
    next_stop_id: int | None
    updated_at: datetime


class NearbyStopOut(StopOut):
    distance_m: float


# ---------- ETA / AI ----------
class EtaOut(BaseModel):
    bus_id: int
    stop_id: int
    eta_minutes: float
    distance_m: float
    smoothed_speed_kmh: float
    predicted_delay_min: float
    confidence: float


class CrowdOut(BaseModel):
    bus_id: int
    level: Literal["LOW", "MEDIUM", "HIGH"]
    probabilities: dict[str, float]
    hour: int
    source: str  # "model" or "heuristic"


class DelayOut(BaseModel):
    bus_id: int
    stop_id: int | None
    predicted_delay_min: float
    injected_delay_min: float
    total_delay_min: float
    source: str


class ScoreBreakdown(BaseModel):
    eta: float
    walk: float
    crowd: float
    delay_risk: float


class RouteOption(BaseModel):
    route_id: int
    route_name: str
    bus_id: int | None
    bus_number: str | None
    board_stop: StopOut
    alight_stop: StopOut
    walk_m: float
    eta_minutes: float | None
    crowd_level: str | None
    predicted_delay_min: float
    score: float
    breakdown: ScoreBreakdown


class BestRouteOut(BaseModel):
    source: str
    destination: str
    weights: dict[str, float]
    options: list[RouteOption]


# ---------- Commuter features ----------
class FavouriteIn(BaseModel):
    type: Literal["ROUTE", "STOP"]
    route_id: int | None = None
    stop_id: int | None = None


class FavouriteOut(ORM):
    id: int
    type: str
    route_id: int | None
    stop_id: int | None


class TripStartIn(BaseModel):
    bus_id: int
    board_stop_id: int
    alight_stop_id: int | None = None


class TripOut(ORM):
    id: int
    bus_id: int | None
    route_id: int | None
    board_stop_id: int | None
    alight_stop_id: int | None
    trip_date: datetime
    status: str


class AlertSubscribeIn(BaseModel):
    bus_id: int
    stop_id: int
    minutes_before: float = Field(default=5, gt=0, le=60)


class AlertSubOut(ORM):
    id: int
    bus_id: int
    stop_id: int
    minutes_before: float
    active: bool
    created_at: datetime


class NotificationOut(ORM):
    id: int
    type: str
    message: str
    created_at: datetime
    is_read: bool


class SosIn(BaseModel):
    bus_id: int | None = None
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class SosOut(ORM):
    id: int
    user_id: int
    bus_id: int | None
    lat: float
    lon: float
    created_at: datetime
    status: str


# ---------- Admin ----------
class SimDelayIn(BaseModel):
    bus_id: int
    minutes: float = Field(ge=0, le=180)


class AuditOut(ORM):
    id: int
    admin_id: int | None
    action: str
    entity: str
    entity_id: str | None
    performed_at: datetime
    details_json: dict | None


class DriverIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str | None = None
    license_no: str = Field(min_length=3, max_length=40)


class DriverOut(ORM, DriverIn):
    id: int


class BusIn(BaseModel):
    bus_number: str = Field(min_length=1, max_length=30)
    capacity: int = Field(default=50, gt=0, le=200)
    driver_id: int | None = None
    route_id: int | None = None
    status: Literal["ACTIVE", "INACTIVE", "MAINTENANCE"] = "ACTIVE"


class RouteIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    source: str = Field(min_length=2, max_length=120)
    destination: str = Field(min_length=2, max_length=120)
    active: bool = True


class StopIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class RouteStopIn(BaseModel):
    route_id: int
    seq: int = Field(ge=0)
    stop_id: int


class RouteStopRowOut(ORM, RouteStopIn):
    pass


class ScheduleIn(BaseModel):
    route_id: int
    stop_id: int
    departure_time: time
    arrival_time: time
    day_of_week: int = Field(ge=0, le=6)


class ScheduleOut(ORM, ScheduleIn):
    id: int


class AnnouncementIn(BaseModel):
    route_id: int | None = None
    message: str = Field(min_length=3, max_length=500)


class AnnouncementOut(ORM):
    id: int
    admin_id: int | None
    route_id: int | None
    message: str
    posted_on: datetime
