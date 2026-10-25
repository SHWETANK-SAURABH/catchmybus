"""FastAPI entrypoint: wires routers, middleware and background services together."""
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
from .routers import auth

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
    yield


app = FastAPI(title="CatchMyBus API", version="1.0.0", lifespan=lifespan)

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
