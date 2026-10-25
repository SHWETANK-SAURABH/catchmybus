"""Test fixtures: an in-memory SQLite DB seeded with demo data, simulator disabled."""
import os

os.environ.update({
    "DATABASE_URL": "sqlite://",
    "SIMULATOR_ENABLED": "false",
    "SIM_RANDOM_DELAYS": "false",
    "DEMO_LOGIN_ENABLED": "false",
    "GUEST_LOGIN_ENABLED": "false",
    "JWT_SECRET": "test-secret-not-for-production",
    "SEED_ADMIN_PASSWORD": "AdminPass1",
    "SEED_COMMUTER_PASSWORD": "ArunPass1",
    "LOGIN_RATE_LIMIT_PER_MIN": "5",
})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.routers.auth import login_limiter  # noqa: E402
from app.seed import seed  # noqa: E402


@pytest.fixture()
def db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed(session, with_history=False)
        yield session


@pytest.fixture()
def client(db):
    from app.cache import cache
    from app.simulator import simulator

    login_limiter.reset()
    simulator.buses.clear()  # fresh simulator state for every test
    cache.clear()
    with TestClient(app) as c:
        yield c


def _token(client, email, password):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture()
def admin_headers(client):
    return {"Authorization": f"Bearer {_token(client, 'admin@catchmybus.com', 'AdminPass1')}"}


@pytest.fixture()
def commuter_headers(client):
    return {"Authorization": f"Bearer {_token(client, 'arun@mail.com', 'ArunPass1')}"}
