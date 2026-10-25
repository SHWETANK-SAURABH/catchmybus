"""Notification service endpoints: alert subscriptions and the in-app inbox (FR13, FR14)."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AlertSubscription, Bus, BusStop, Notification, User
from ..pagination import PageParams, paginate
from ..schemas import AlertSubOut, AlertSubscribeIn, NotificationOut, Page
from ..security import get_current_user

router = APIRouter(tags=["notifications"])


@router.post("/alerts/subscribe", response_model=AlertSubOut, status_code=status.HTTP_201_CREATED)
def subscribe(body: AlertSubscribeIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if db.get(Bus, body.bus_id) is None or db.get(BusStop, body.stop_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown bus or stop")
    sub = AlertSubscription(user_id=user.id, **body.model_dump())
    db.add(sub)
    db.commit()
    return sub


@router.get("/alerts", response_model=list[AlertSubOut])
def my_alerts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(select(AlertSubscription).where(AlertSubscription.user_id == user.id,
                                                      AlertSubscription.active.is_(True))).all()


@router.delete("/alerts/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_alert(sub_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    sub = db.get(AlertSubscription, sub_id)
    if sub is None or sub.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
    sub.active = False
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/notifications", response_model=Page[NotificationOut])
def my_notifications(params: PageParams = Depends(), db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    stmt = select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc())
    return paginate(db, stmt, params)


@router.get("/notifications/unread-count")
def unread_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.scalar(select(func.count()).where(Notification.user_id == user.id, Notification.is_read.is_(False)))
    return {"unread": n or 0}


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
def read_all(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.execute(update(Notification).where(Notification.user_id == user.id).values(is_read=True))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
