"""Notification service (FR13, FR14): persist a notification and push it over WebSocket."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Notification, User
from ..schemas import NotificationOut
from .hub import hub


def notify(db: Session, user_id: int, type_: str, message: str, commit: bool = True) -> Notification:
    """Store a notification and push it to the user's open /ws/notifications sockets."""
    n = Notification(user_id=user_id, type=type_, message=message)
    db.add(n)
    if commit:
        db.commit()
    else:
        db.flush()
    payload = {"type": "notification", "notification": NotificationOut.model_validate(n).model_dump(mode="json")}
    hub.send_to_user_threadsafe(user_id, payload)
    return n


def notify_admins(db: Session, type_: str, message: str, commit: bool = True):
    for admin_id in db.scalars(select(User.id).where(User.role == "ADMIN")).all():
        notify(db, admin_id, type_, message, commit=False)
    if commit:
        db.commit()
