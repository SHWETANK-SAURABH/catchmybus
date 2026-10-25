"""Background alert engine: arrival alerts (ETA <= threshold) and delay alerts (delay > threshold).

Runs as a simulator listener every ALERT_CHECK_SECONDS. Alerts are persisted and pushed
over /ws/notifications. Flags on each subscription/trip stop duplicate alerts.
"""
import asyncio
import logging
import time
from datetime import datetime
from typing import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..clock import now_local
from ..config import get_settings
from ..db import SessionLocal
from ..models import AlertSubscription, Bus, BusStop, Trip
from .eta import EtaResult, eta_for
from .notifications import notify

log = logging.getLogger("catchmybus.alerts")

EtaFn = Callable[[int, int, datetime], EtaResult | None]


def should_send_arrival(eta_minutes: float, minutes_before: float, already_sent: bool) -> bool:
    """Arrival alert fires once, as soon as the ETA drops to the user's threshold."""
    return not already_sent and eta_minutes <= minutes_before


def delay_alert_state(total_delay_min: float, threshold_min: float, already_sent: bool) -> tuple[bool, bool]:
    """Return (send_now, new_sent_flag) for a delay alert.

    Sends once when the delay goes above the threshold; re-arms only after the delay
    falls below half the threshold, so a value hovering at the limit doesn't spam.
    """
    if total_delay_min > threshold_min and not already_sent:
        return True, True
    if already_sent and total_delay_min < threshold_min / 2:
        return False, False
    return False, already_sent


class AlertEngine:
    def __init__(self):
        self._last_run = 0.0
        self._trip_delay_sent: set[int] = set()  # trip ids already told about the current delay

    async def __call__(self, _sim=None):
        """Simulator listener: rate-limited to one check per ALERT_CHECK_SECONDS."""
        if time.monotonic() - self._last_run < get_settings().alert_check_seconds:
            return
        self._last_run = time.monotonic()
        await asyncio.to_thread(self.check_once)

    def check_once(self) -> int:
        with SessionLocal() as db:
            return self.check(db)

    def check(self, db: Session, when: datetime | None = None, eta_fn: EtaFn = eta_for) -> int:
        """Evaluate every active subscription and ongoing trip; return alerts sent."""
        when = when or now_local()
        threshold = get_settings().delay_alert_threshold_min
        sent = 0
        names = _NameCache(db)

        for sub in db.scalars(select(AlertSubscription).where(AlertSubscription.active.is_(True))).all():
            res = eta_fn(sub.bus_id, sub.stop_id, when)
            if res is None:
                continue
            bus, stop = names.bus(sub.bus_id), names.stop(sub.stop_id)
            send_delay, sub.delay_sent = delay_alert_state(res.total_delay_min, threshold, sub.delay_sent)
            if send_delay:
                notify(db, sub.user_id, "DELAY",
                       f"Bus {bus} is delayed by about {res.total_delay_min:.0f} min. "
                       f"New ETA at {stop}: {res.eta_minutes:.0f} min.", commit=False)
                sent += 1
            if should_send_arrival(res.eta_minutes, sub.minutes_before, sub.arrival_sent):
                notify(db, sub.user_id, "ARRIVAL",
                       f"Bus {bus} arrives at {stop} in about {max(res.eta_minutes, 0):.0f} min.", commit=False)
                sub.arrival_sent = True
                sub.active = False  # one-shot subscription
                sent += 1

        for trip in db.scalars(select(Trip).where(Trip.status == "ONGOING", Trip.bus_id.is_not(None))).all():
            target = trip.alight_stop_id or trip.board_stop_id
            res = eta_fn(trip.bus_id, target, when) if target else None
            if res is None:
                continue
            already = trip.id in self._trip_delay_sent
            send, now_sent = delay_alert_state(res.total_delay_min, threshold, already)
            if send:
                notify(db, trip.user_id, "DELAY",
                       f"Your bus {names.bus(trip.bus_id)} is delayed by about {res.total_delay_min:.0f} min.",
                       commit=False)
                sent += 1
            (self._trip_delay_sent.add if now_sent else self._trip_delay_sent.discard)(trip.id)

        db.commit()
        if sent:
            log.info("alerts sent", extra={"fields": {"count": sent}})
        return sent


class _NameCache:
    """Avoids re-querying bus numbers / stop names inside one check."""

    def __init__(self, db: Session):
        self.db, self._b, self._s = db, {}, {}

    def bus(self, bus_id: int) -> str:
        if bus_id not in self._b:
            b = self.db.get(Bus, bus_id)
            self._b[bus_id] = b.bus_number if b else f"#{bus_id}"
        return self._b[bus_id]

    def stop(self, stop_id: int) -> str:
        if stop_id not in self._s:
            s = self.db.get(BusStop, stop_id)
            self._s[stop_id] = s.name if s else f"stop #{stop_id}"
        return self._s[stop_id]


alert_engine = AlertEngine()
