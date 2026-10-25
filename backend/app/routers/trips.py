"""Trip history (FR22): start, complete and list a commuter's trips."""
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Bus, BusStop, Trip, User
from ..pagination import PageParams, paginate
from ..schemas import Page, TripOut, TripStartIn
from ..security import get_current_user

router = APIRouter(prefix="/trips", tags=["trips"])


@router.post("/start", response_model=TripOut, status_code=status.HTTP_201_CREATED)
def start_trip(body: TripStartIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bus = db.get(Bus, body.bus_id)
    if bus is None or db.get(BusStop, body.board_stop_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown bus or stop")
    if body.alight_stop_id is not None and db.get(BusStop, body.alight_stop_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown alighting stop")
    trip = Trip(user_id=user.id, bus_id=bus.id, route_id=bus.route_id, board_stop_id=body.board_stop_id,
                alight_stop_id=body.alight_stop_id, status="ONGOING")
    db.add(trip)
    db.commit()
    return trip


@router.post("/{trip_id}/complete", response_model=TripOut)
def complete_trip(trip_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    trip = db.get(Trip, trip_id)
    if trip is None or trip.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    if trip.status == "COMPLETED":
        raise HTTPException(status.HTTP_409_CONFLICT, "Trip already completed")
    trip.status = "COMPLETED"
    db.commit()
    return trip


@router.get("", response_model=Page[TripOut])
def trip_history(date_from: date | None = None, date_to: date | None = None, params: PageParams = Depends(),
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The user's trips, newest first, optionally limited to [date_from, date_to] (inclusive)."""
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "date_from must be before date_to")
    stmt = select(Trip).where(Trip.user_id == user.id).order_by(Trip.trip_date.desc(), Trip.id.desc())
    if date_from:
        stmt = stmt.where(Trip.trip_date >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(Trip.trip_date < datetime.combine(date_to + timedelta(days=1), time.min))
    return paginate(db, stmt, params)

