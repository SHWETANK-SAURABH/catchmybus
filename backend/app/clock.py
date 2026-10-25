"""Local time helpers. Patterns are defined in Vellore local time (IST), whatever the server TZ.

The UI can send an `X-Demo-Time: HH:MM` header so the AI endpoints behave as if it were,
say, 08:30 on a weekday - used in the demo to show peak vs off-peak crowding.
"""
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import Header

from .config import get_settings


def now_local() -> datetime:
    """Current wall-clock time in the configured timezone (naive datetime)."""
    return datetime.now(ZoneInfo(get_settings().timezone)).replace(tzinfo=None)


def parse_demo_time(value: str | None, base: datetime | None = None) -> datetime:
    """Return `base` (default: now) with the hour/minute replaced by an "HH:MM" override.

    Invalid or empty values are ignored so a bad header can never break a request.
    """
    base = base or now_local()
    if not value:
        return base
    try:
        hh, mm = value.strip().split(":")
        return base.replace(hour=int(hh), minute=int(mm), second=0, microsecond=0)
    except (ValueError, TypeError):
        return base


def effective_time(x_demo_time: str | None = Header(default=None)) -> datetime:
    """FastAPI dependency: the time the AI models should reason about."""
    return parse_demo_time(x_demo_time)
