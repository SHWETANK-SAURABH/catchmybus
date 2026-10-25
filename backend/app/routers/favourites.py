"""Favourite routes and stops (FR11, FR12)."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import BusStop, Favourite, Route, User
from ..schemas import FavouriteIn, FavouriteOut
from ..security import get_current_user

router = APIRouter(prefix="/favourites", tags=["favourites"])


@router.get("", response_model=list[FavouriteOut])
def list_favourites(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(select(Favourite).where(Favourite.user_id == user.id).order_by(Favourite.id)).all()


@router.post("", response_model=FavouriteOut, status_code=status.HTTP_201_CREATED)
def add_favourite(body: FavouriteIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if body.type == "ROUTE":
        if body.route_id is None or db.get(Route, body.route_id) is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Valid route_id required for a ROUTE favourite")
        body.stop_id = None
    else:
        if body.stop_id is None or db.get(BusStop, body.stop_id) is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Valid stop_id required for a STOP favourite")
        body.route_id = None
    existing = db.scalar(select(Favourite).where(
        Favourite.user_id == user.id, Favourite.type == body.type,
        Favourite.route_id == body.route_id, Favourite.stop_id == body.stop_id))
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already a favourite")
    fav = Favourite(user_id=user.id, **body.model_dump())
    db.add(fav)
    db.commit()
    return fav


@router.delete("/{fav_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favourite(fav_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    fav = db.get(Favourite, fav_id)
    if fav is None or fav.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Favourite not found")
    db.delete(fav)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
