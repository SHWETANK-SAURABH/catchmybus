"""FastAPI entrypoint: wires routers, middleware and background services together."""
import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from .config import get_settings
from .db import SessionLocal, init_db
from .logging_conf import setup_logging
from .models import User
from .ml.predictor import predictor
from .routers import admin, ai, auth, eta, favourites, notifications, routes, sos, stops, tracking, trips
from .services.alert_engine import alert_engine
from .services.crowd_job import crowd_job
from .services.hub import hub
from .simulator import simulator

setup_logging()
log = logging.getLogger("catchmybus.api")


def ensure_seeded():
    """Seed demo data automatically on the very first start (empty database)."""
    from .seed import seed

    with SessionLocal() as db:
        if db.scalar(select(User).limit(1)) is None:
            try:
                log.info("empty database - seeding demo data", extra={"fields": seed(db)})
            except RuntimeError as e:
                log.warning(f"auto-seed skipped: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ensure_seeded()
    hub.loop = asyncio.get_running_loop()
    predictor.load()
    tasks = []
    if get_settings().simulator_enabled:
        for listener in (alert_engine, crowd_job):
            if listener not in simulator.listeners:
                simulator.listeners.append(listener)
        tasks.append(asyncio.create_task(simulator.run(), name="simulator"))
    else:
        simulator.sync_with_db()  # positions still available, buses just don't move
    yield
    for t in tasks:
        t.cancel()


app = FastAPI(title="CatchMyBus API", version="1.0.0", lifespan=lifespan)


class StripPrefixMiddleware:
    """Serve the API under a public path prefix (e.g. /api on Vercel) without changing routes.

    Vercel forwards `/api/buses` to the backend unchanged; this rewrites it to `/buses`
    (HTTP and WebSocket) and sets root_path so /docs links still work. Requests without
    the prefix, as in local development, pass through untouched.
    """

    def __init__(self, app, prefix: str):
        self.app = app
        self.prefix = prefix.rstrip("/")

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if self.prefix and scope["type"] in ("http", "websocket") and (
                path == self.prefix or path.startswith(self.prefix + "/")):
            scope = dict(scope, path=path[len(self.prefix):] or "/", root_path=self.prefix)
        await self.app(scope, receive, send)


app.add_middleware(StripPrefixMiddleware, prefix=get_settings().api_prefix)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_origin],  # locked to the frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def access_log(request: Request, call_next):
    """One structured log line per request with latency in ms."""
    start = time.perf_counter()
    response = await call_next(request)
    log.info("request", extra={"fields": {
        "method": request.method, "path": request.url.path, "status": response.status_code,
        "ms": round((time.perf_counter() - start) * 1000, 1)}})
    return response


@app.get("/health", tags=["health"])
def health():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(tracking.router)
app.include_router(stops.router)  # before routes: /routes/search must win over /routes/{id}
app.include_router(routes.router)
app.include_router(eta.router)
app.include_router(favourites.router)
app.include_router(notifications.router)
app.include_router(sos.router)
app.include_router(trips.router)
app.include_router(ai.router)
app.include_router(admin.router)
