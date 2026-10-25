"""WebSocket hub: fan-out of tracking updates and per-user notifications.

Sync code (normal request handlers) can call `publish_*_threadsafe`, which hands the
message to the event loop that owns the sockets.
"""
import asyncio
import json
import logging

from fastapi import WebSocket

log = logging.getLogger("catchmybus.ws")


class Hub:
    def __init__(self):
        self.tracking: set[WebSocket] = set()
        self.users: dict[int, set[WebSocket]] = {}
        self.loop: asyncio.AbstractEventLoop | None = None

    # ----- connection management -----
    def add_tracking(self, ws: WebSocket):
        self.tracking.add(ws)

    def remove_tracking(self, ws: WebSocket):
        self.tracking.discard(ws)

    def add_user(self, user_id: int, ws: WebSocket):
        self.users.setdefault(user_id, set()).add(ws)

    def remove_user(self, user_id: int, ws: WebSocket):
        self.users.get(user_id, set()).discard(ws)

    # ----- sending -----
    async def _send(self, sockets: set[WebSocket], message: dict):
        text = json.dumps(message, default=str)
        for ws in list(sockets):
            try:
                await ws.send_text(text)
            except Exception:  # client went away
                sockets.discard(ws)

    async def broadcast_tracking(self, message: dict):
        await self._send(self.tracking, message)

    async def send_to_user(self, user_id: int, message: dict):
        await self._send(self.users.get(user_id, set()), message)

    def send_to_user_threadsafe(self, user_id: int, message: dict):
        """Schedule a user message from any thread; no-op if the loop isn't running (tests)."""
        if self.loop and self.loop.is_running() and self.users.get(user_id):
            asyncio.run_coroutine_threadsafe(self.send_to_user(user_id, message), self.loop)


hub = Hub()
