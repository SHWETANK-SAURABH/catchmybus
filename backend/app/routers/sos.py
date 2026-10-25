"""Commuter-side SOS (FR25) and public announcements feed."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Announcement, Bus, SosAlert, User
from ..schemas import AnnouncementOut, SosIn, SosOut
from ..security import get_current_user
from ..services.notifications import notify_admins

router = APIRouter(tags=["sos"])


@router.post("/sos", response_model=SosOut, status_code=status.HTTP_201_CREATED)
def send_sos(body: SosIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bus = db.get(Bus, body.bus_id) if body.bus_id else None
    if body.bus_id and bus is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown bus")
    sos = SosAlert(user_id=user.id, bus_id=body.bus_id, lat=body.lat, lon=body.lon)
    db.add(sos)
    db.flush()
    where = f" on bus {bus.bus_number}" if bus else ""
    notify_admins(db, "SOS", f"SOS #{sos.id} from {user.name} ({user.phone or user.email}){where} "
                             f"at {body.lat:.5f}, {body.lon:.5f}", commit=False)
    db.commit()
    return sos


@router.get("/announcements", response_model=list[AnnouncementOut])
def recent_announcements(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.scalars(select(Announcement).order_by(Announcement.id.desc()).limit(10)).all()
