"""Tiny in-memory sliding-window rate limiter (used on POST /auth/login)."""
import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, max_calls: int, window_seconds: float = 60.0):
        self.max_calls = max_calls
        self.window = window_seconds
        self._calls: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, now: float | None = None) -> bool:
        """Record a call for `key`; return False if it exceeds max_calls in the window."""
        now = time.monotonic() if now is None else now
        q = self._calls[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.max_calls:
            return False
        q.append(now)
        return True

    def reset(self):
        self._calls.clear()
