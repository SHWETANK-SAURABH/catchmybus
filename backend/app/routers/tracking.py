"""Live Tracking service: bus list, single-bus location and the WebSocket feeds (FR06, FR10)."""
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..cache import cache
from ..db import SessionLocal, get_db
from ..models import Bus, User
from ..schemas import BusLocationOut, BusOut
from ..security import get_current_user, user_from_token
from ..services.hub import hub
from ..simulator import public_snapshot

router = APIRouter(tags=["tracking"])


@router.get("/buses", response_model=list[BusOut])
def list_buses(route_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    stmt = select(Bus).order_by(Bus.id)
    if route_id is not None:
        stmt = stmt.where(Bus.route_id == route_id)
    return db.scalars(stmt).all()


@router.get("/buses/live", response_model=list[BusLocationOut])
def live_positions(_: User = Depends(get_current_user)):
    """Latest position of every simulated bus (polling fallback for the WebSocket)."""
    return [public_snapshot(p) for p in cache.all_positions()]


@router.get("/buses/{bus_id}/location", response_model=BusLocationOut)
def bus_location(bus_id: int, _: User = Depends(get_current_user)):
    pos = cache.get_position(bus_id)
    if not pos:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No live position for this bus")
    return public_snapshot(pos)


def _ws_user(token: str | None) -> User | None:
    if not token:
        return None
    with SessionLocal() as db:
        return user_from_token(db, token)


@router.websocket("/ws/tracking")
async def ws_tracking(ws: WebSocket, token: str | None = Query(default=None)):
    """Pushes {"type": "positions", "buses": [...]} every simulator tick."""
    if _ws_user(token) is None:
        await ws.close(code=4401)
        return
    await ws.accept()
    hub.add_tracking(ws)
    await ws.send_json({"type": "positions", "buses": [public_snapshot(p) for p in cache.all_positions()]})
    try:
        while True:
            await ws.receive_text()  # keep-alive pings from the client; content ignored
    except WebSocketDisconnect:
        pass
    finally:
        hub.remove_tracking(ws)


@router.websocket("/ws/notifications")
async def ws_notifications(ws: WebSocket, token: str | None = Query(default=None)):
    """Per-user channel for arrival/delay/announcement/SOS notifications (JWT in query)."""
    user = _ws_user(token)
    if user is None:
        await ws.close(code=4401)
        return
    await ws.accept()
    hub.add_user(user.id, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        hub.remove_user(user.id, ws)
