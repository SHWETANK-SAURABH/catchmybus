"""Local time helpers. Patterns are defined in Vellore local time (IST), whatever the server TZ.

The UI can send an `X-Demo-Time` header so the AI endpoints behave as if it were another
time - used in the demo to show peak vs off-peak crowding:
    "08:30"      -> 08:30 on a weekday (today if it is a weekday, else the coming Monday)
    "Sat 12:00"  -> 12:00 on the coming Saturday (Mon..Sun accepted)
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import Header

from .config import get_settings

DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def now_local() -> datetime:
    """Current wall-clock time in the configured timezone (naive datetime)."""
    return datetime.now(ZoneInfo(get_settings().timezone)).replace(tzinfo=None)


def to_local(utc_naive: datetime) -> datetime:
    """Convert a naive UTC timestamp (as stored in the DB) to naive local time."""
    return utc_naive.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(get_settings().timezone)).replace(tzinfo=None)


def to_utc(local_naive: datetime) -> datetime:
    """Convert a naive local timestamp to naive UTC for storage."""
    return local_naive.replace(tzinfo=ZoneInfo(get_settings().timezone)).astimezone(timezone.utc).replace(tzinfo=None)


def parse_demo_time(value: str | None, base: datetime | None = None) -> datetime:
    """Apply an "HH:MM" / "Day HH:MM" override to `base` (default: now).

    Without a day, a weekend base is moved forward to Monday so "08:30" always shows the
    weekday peak. Invalid values are ignored so a bad header can never break a request.
    """
    base = base or now_local()
    if not value:
        return base
    try:
        parts = value.strip().lower().split()
        day = DAYS.index(parts[0][:3]) if len(parts) == 2 else None
        hh, mm = parts[-1].split(":")
        t = base.replace(hour=int(hh), minute=int(mm), second=0, microsecond=0)
    except (ValueError, TypeError, IndexError):
        return base
    if day is None:
        if t.weekday() >= 5:
            t += timedelta(days=7 - t.weekday())
    else:
        t += timedelta(days=(day - t.weekday()) % 7)
    return t


def effective_time(x_demo_time: str | None = Header(default=None)) -> datetime:
    """FastAPI dependency: the time the AI models should reason about."""
    return parse_demo_time(x_demo_time)
