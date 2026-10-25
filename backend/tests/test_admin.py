"""Role-based access, admin CRUD with audit logging, SOS and simulated delays (FR25, FR28-31, NFR14)."""
import pytest
from sqlalchemy import select

from app.models import AuditLog, Notification, User

ADMIN_GETS = ["/admin/buses", "/admin/drivers", "/admin/routes", "/admin/stops", "/admin/schedules",
              "/admin/announcements", "/admin/audit-log", "/admin/sos", "/admin/users",
              "/admin/route-stops?route_id=1"]


@pytest.mark.parametrize("path", ADMIN_GETS)
def test_commuter_gets_403_on_admin_endpoints(client, commuter_headers, path):
    assert client.get(path, headers=commuter_headers).status_code == 403


def test_commuter_cannot_write_admin(client, commuter_headers):
    h = commuter_headers
    assert client.post("/admin/drivers", json={"name": "X Y", "license_no": "L-123"}, headers=h).status_code == 403
    assert client.post("/admin/sim/delay", json={"bus_id": 1, "minutes": 15}, headers=h).status_code == 403
    assert client.delete("/admin/buses/1", headers=h).status_code == 403


def test_anonymous_gets_401(client):
    assert client.get("/admin/buses").status_code == 401


def test_admin_list_is_paginated(client, admin_headers):
    page = client.get("/admin/schedules?page=2&size=10", headers=admin_headers).json()
    assert page["page"] == 2 and page["size"] == 10 and len(page["items"]) == 10
    assert page["total"] > 1000


def test_admin_crud_writes_audit_log(client, admin_headers, db):
    h = admin_headers
    admin_id = db.scalar(select(User.id).where(User.role == "ADMIN"))
    r = client.post("/admin/drivers", json={"name": "Test Driver", "license_no": "TN-TEST-1"}, headers=h)
    assert r.status_code == 201
    did = r.json()["id"]
    r = client.put(f"/admin/drivers/{did}", json={"name": "Renamed Driver", "license_no": "TN-TEST-1"}, headers=h)
    assert r.status_code == 200 and r.json()["name"] == "Renamed Driver"
    assert client.delete(f"/admin/drivers/{did}", headers=h).status_code == 204

    log = client.get("/admin/audit-log?entity=driver", headers=h).json()["items"]
    assert [e["action"] for e in log] == ["DELETE", "UPDATE", "CREATE"]
    assert all(e["admin_id"] == admin_id and e["performed_at"] for e in log)
    assert log[1]["details_json"]["changes"] == {"name": {"from": "Test Driver", "to": "Renamed Driver"}}


def test_failed_admin_write_leaves_no_audit_row(client, admin_headers, db):
    before = len(db.scalars(select(AuditLog)).all())
    # duplicate unique license number -> 409, and the audit row must be rolled back too
    r = client.post("/admin/drivers", json={"name": "Dup", "license_no": "TN23-DL-0001"}, headers=admin_headers)
    assert r.status_code == 409
    db.expire_all()
    assert len(db.scalars(select(AuditLog)).all()) == before


def test_admin_validation_errors(client, admin_headers):
    r = client.post("/admin/stops", json={"name": "Bad", "lat": 200, "lon": 79}, headers=admin_headers)
    assert r.status_code == 422
    assert client.get("/admin/buses/9999", headers=admin_headers).status_code == 404


def test_route_stop_add_and_remove(client, admin_headers):
    h = admin_headers
    n = len(client.get("/admin/route-stops?route_id=1", headers=h).json())
    r = client.post("/admin/route-stops", json={"route_id": 1, "seq": 50, "stop_id": 1}, headers=h)
    assert r.status_code == 201
    assert client.post("/admin/route-stops", json={"route_id": 1, "seq": 50, "stop_id": 2}, headers=h).status_code == 409
    assert len(client.get("/admin/route-stops?route_id=1", headers=h).json()) == n + 1
    assert client.delete("/admin/route-stops/1/50", headers=h).status_code == 204


def test_sim_delay_is_audited(client, admin_headers):
    r = client.post("/admin/sim/delay", json={"bus_id": 1, "minutes": 15}, headers=admin_headers)
    assert r.status_code == 200
    from app.simulator import simulator
    assert simulator.buses[1].hold_left == 15 * 60
    entry = client.get("/admin/audit-log", headers=admin_headers).json()["items"][0]
    assert entry["action"] == "SIM_DELAY" and entry["details_json"] == {"minutes": 15}
    assert client.post("/admin/sim/delay", json={"bus_id": 999, "minutes": 5}, headers=admin_headers).status_code == 404


def test_sim_delay_triggers_delay_alert(client, admin_headers, commuter_headers, db):
    from app.services.alert_engine import AlertEngine

    client.post("/alerts/subscribe", json={"bus_id": 1, "stop_id": 9, "minutes_before": 1}, headers=commuter_headers)
    client.post("/admin/sim/delay", json={"bus_id": 1, "minutes": 15}, headers=admin_headers)
    assert AlertEngine().check(db) >= 1
    arun = db.scalar(select(User).where(User.email == "arun@mail.com"))
    types = [n.type for n in db.scalars(select(Notification).where(Notification.user_id == arun.id))]
    assert "DELAY" in types


def test_sos_reaches_admin_feed(client, commuter_headers, admin_headers, db):
    r = client.post("/sos", json={"bus_id": 1, "lat": 12.95, "lon": 79.14}, headers=commuter_headers)
    assert r.status_code == 201
    feed = client.get("/admin/sos", headers=admin_headers).json()
    assert feed["total"] == 1 and feed["items"][0]["status"] == "OPEN"
    admin = db.scalar(select(User).where(User.role == "ADMIN"))
    assert db.scalar(select(Notification).where(Notification.user_id == admin.id, Notification.type == "SOS"))
    sid = feed["items"][0]["id"]
    assert client.post(f"/admin/sos/{sid}/resolve", headers=admin_headers).json()["status"] == "RESOLVED"


def test_announcement_notifies_commuters(client, admin_headers, commuter_headers):
    r = client.post("/admin/announcements", json={"route_id": 1, "message": "Diversion near Green Circle"},
                    headers=admin_headers)
    assert r.status_code == 201
    inbox = client.get("/notifications", headers=commuter_headers).json()["items"]
    assert inbox[0]["type"] == "ANNOUNCEMENT" and "Green Circle" in inbox[0]["message"]
    assert client.get("/announcements", headers=commuter_headers).json()[0]["message"].startswith("Diversion")
