"""FT: authentication, password hashing and rate limiting (FR01, FR02, NFR04)."""
from sqlalchemy import select

from app.models import User
from app.ratelimit import RateLimiter
from app.security import verify_password


def test_register_creates_commuter_with_bcrypt_hash(client, db):
    r = client.post("/auth/register", json={"name": "Priya", "email": "Priya@Mail.com", "password": "secret12"})
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["role"] == "COMMUTER"
    assert body["user"]["email"] == "priya@mail.com"
    user = db.scalar(select(User).where(User.email == "priya@mail.com"))
    assert user.password_hash.startswith("$2")  # bcrypt prefix
    assert user.password_hash != "secret12"
    assert verify_password("secret12", user.password_hash)


def test_register_duplicate_email_conflict(client):
    r = client.post("/auth/register", json={"name": "Arun", "email": "arun@mail.com", "password": "whatever1"})
    assert r.status_code == 409


def test_register_validates_input(client):
    r = client.post("/auth/register", json={"name": "A", "email": "not-an-email", "password": "1"})
    assert r.status_code == 422


def test_login_and_me(client):
    r = client.post("/auth/login", json={"email": "arun@mail.com", "password": "ArunPass1"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["email"] == "arun@mail.com"


def test_login_wrong_password(client):
    r = client.post("/auth/login", json={"email": "arun@mail.com", "password": "nope"})
    assert r.status_code == 401


def test_me_requires_valid_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_login_rate_limited(client):
    codes = [client.post("/auth/login", json={"email": "x@y.com", "password": "bad"}).status_code
             for _ in range(7)]
    assert codes[:5] == [401] * 5
    assert codes[-1] == 429


def test_rate_limiter_window_expires():
    rl = RateLimiter(2, window_seconds=60)
    assert rl.allow("ip", now=0) and rl.allow("ip", now=1)
    assert not rl.allow("ip", now=2)
    assert rl.allow("ip", now=62)  # first calls fell out of the window


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_api_prefix_is_stripped_for_vercel_routing(client, commuter_headers):
    # Vercel forwards /api/* unchanged; the same routes must answer with and without the prefix.
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/api/buses", headers=commuter_headers).json() == client.get("/buses", headers=commuter_headers).json()
    assert client.get("/apix/health").status_code == 404  # only the exact prefix is stripped
    with client.websocket_connect("/api/ws/tracking?token=" + commuter_headers["Authorization"].split()[1]) as ws:
        assert ws.receive_json()["type"] == "positions"


def test_demo_login_disabled_by_default(client):
    assert client.get("/auth/demo").json()["enabled"] is False
    assert client.post("/auth/demo-login", json={"role": "COMMUTER"}).status_code == 404


def test_demo_login_signs_in_seeded_accounts(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "demo_login_enabled", True)
    assert client.get("/auth/demo").json()["enabled"] is True
    r = client.post("/auth/demo-login", json={"role": "COMMUTER"})
    assert r.status_code == 200 and r.json()["user"]["email"] == "arun@mail.com"
    admin = client.post("/auth/demo-login", json={"role": "ADMIN"}).json()
    assert admin["user"]["role"] == "ADMIN"
    h = {"Authorization": f"Bearer {admin['access_token']}"}
    assert client.get("/admin/buses", headers=h).status_code == 200
    assert client.post("/auth/demo-login", json={"role": "ROOT"}).status_code == 422


def test_guest_login_disabled_by_default(client):
    assert client.get("/auth/demo").json() == {"enabled": False, "guest": False}
    assert client.post("/auth/guest").status_code == 404


def test_guest_login_creates_separate_commuters(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "guest_login_enabled", True)
    a, b = client.post("/auth/guest").json(), client.post("/auth/guest").json()
    assert a["user"]["role"] == "COMMUTER" and a["user"]["name"] == "Guest"
    assert a["user"]["id"] != b["user"]["id"]  # each visitor gets their own account
    ha = {"Authorization": f"Bearer {a['access_token']}"}
    hb = {"Authorization": f"Bearer {b['access_token']}"}
    assert client.post("/favourites", json={"type": "ROUTE", "route_id": 1}, headers=ha).status_code == 201
    assert client.get("/favourites", headers=hb).json() == []  # not shared
    assert client.get("/admin/buses", headers=ha).status_code == 403  # guests are never admins
