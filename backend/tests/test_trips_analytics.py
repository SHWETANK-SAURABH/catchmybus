"""Trip history (FR22) and admin analytics (FR33)."""
from datetime import date, timedelta


def test_trip_lifecycle_and_history(client, commuter_headers):
    h = commuter_headers
    r = client.post("/trips/start", json={"bus_id": 1, "board_stop_id": 1, "alight_stop_id": 9}, headers=h)
    assert r.status_code == 201 and r.json()["status"] == "ONGOING" and r.json()["route_id"] == 1
    tid = r.json()["id"]
    assert client.post(f"/trips/{tid}/complete", headers=h).json()["status"] == "COMPLETED"
    assert client.post(f"/trips/{tid}/complete", headers=h).status_code == 409
    today = date.today()
    page = client.get(f"/trips?date_from={today - timedelta(days=1)}&date_to={today + timedelta(days=1)}", headers=h).json()
    assert page["total"] == 1 and page["items"][0]["id"] == tid
    old = client.get(f"/trips?date_from=2020-01-01&date_to=2020-01-31", headers=h).json()
    assert old["total"] == 0
    assert client.get("/trips?date_from=2026-02-01&date_to=2026-01-01", headers=h).status_code == 422


def test_trips_are_private(client, commuter_headers, admin_headers):
    tid = client.post("/trips/start", json={"bus_id": 1, "board_stop_id": 1}, headers=commuter_headers).json()["id"]
    assert client.post(f"/trips/{tid}/complete", headers=admin_headers).status_code == 404


def test_analytics_shape(client, admin_headers, commuter_headers):
    client.post("/trips/start", json={"bus_id": 3, "board_stop_id": 10}, headers=commuter_headers)
    client.post("/sos", json={"lat": 12.95, "lon": 79.14}, headers=commuter_headers)
    a = client.get("/admin/analytics?days=7", headers=admin_headers).json()
    assert a["total_trips"] == 1
    assert {r["route_id"]: r["trips"] for r in a["ridership_by_route"]}[2] == 1
    assert len(a["ridership_by_hour"]) == 19
    assert [c["level"] for c in a["crowd_distribution"]] == ["LOW", "MEDIUM", "HIGH"]
    assert a["sos"] == {"total": 1, "open": 1, "resolved": 0}
    assert client.get("/admin/analytics", headers=commuter_headers).status_code == 403
