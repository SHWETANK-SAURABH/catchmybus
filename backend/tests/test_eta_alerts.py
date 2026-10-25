"""ETA math, nearby-stop radius, route search and alert thresholds (FR07-FR09, FR13, FR14)."""
from datetime import datetime

import pytest
from sqlalchemy import select

from app.models import AlertSubscription, Notification, Trip, User
from app.routers.stops import bounding_box, stops_within
from app.services.alert_engine import AlertEngine, delay_alert_state, should_send_arrival
from app.services.eta import EtaResult, confidence_score, remaining_distance_m, travel_minutes

WHEN = datetime(2026, 10, 26, 14, 0)  # a Monday afternoon


# ---------- ETA math ----------
def test_remaining_distance_stop_ahead_and_behind():
    assert remaining_distance_m(1000, +1, 5000, 3000, False) == 2000
    # stop behind an outbound bus: drive to the end (4000) and back (2000)
    assert remaining_distance_m(1000, +1, 5000, 3000 - 2500, False) == 4000 + 4500
    assert remaining_distance_m(3000, -1, 5000, 1000, False) == 2000
    # stop "ahead" of an inbound bus is reached after turning at the start
    assert remaining_distance_m(3000, -1, 5000, 4000, False) == 3000 + 4000


def test_remaining_distance_loop_wraps():
    assert remaining_distance_m(4500, +1, 5000, 500, True) == pytest.approx(1000)
    assert remaining_distance_m(500, +1, 5000, 4500, True) == pytest.approx(4000)
    assert remaining_distance_m(10, +1, 5000, 5000, True) == pytest.approx(4990)


def test_travel_minutes_and_speed_floor():
    assert travel_minutes(1000, 30) == pytest.approx(2.0)  # 1 km at 30 km/h = 2 min
    assert travel_minutes(1000, 0) == travel_minutes(1000, 8)  # floored at 8 km/h
    assert travel_minutes(1000, 30, speed_multiplier=2) == pytest.approx(1.0)


def test_confidence_drops_with_distance_and_holds():
    near, far = confidence_score(200, 25, 0), confidence_score(6000, 25, 0)
    assert 0.3 <= far < near <= 0.95
    assert confidence_score(200, 25, 5) < near
    assert confidence_score(50_000, 2, 10) == 0.3


def test_eta_endpoint_decreases_as_bus_approaches(client, commuter_headers):
    from app.simulator import simulator

    bus_id = next(b for b, st in simulator.buses.items() if not st.geom.is_loop and st.direction == 1)
    st = simulator.buses[bus_id]
    stop = st.geom.stops[-1]
    first = client.get(f"/eta?bus_id={bus_id}&stop_id={stop.stop_id}", headers=commuter_headers).json()
    for _ in range(15):
        simulator.tick(2.0)
    second = client.get(f"/eta?bus_id={bus_id}&stop_id={stop.stop_id}", headers=commuter_headers).json()
    assert second["distance_m"] < first["distance_m"]
    assert second["eta_minutes"] < first["eta_minutes"]
    assert 0 < first["confidence"] <= 1


def test_eta_unknown_stop_is_404(client, commuter_headers):
    assert client.get("/eta?bus_id=1&stop_id=99999", headers=commuter_headers).status_code == 404


# ---------- Nearby stops / search ----------
def test_bounding_box_contains_radius():
    lat0, lat1, lon0, lon1 = bounding_box(12.97, 79.14, 1000)
    assert lat1 - lat0 == pytest.approx(2 * 1000 / 111_320, rel=1e-6)
    assert (lon1 - lon0) > (lat1 - lat0)  # longitude degrees are shorter near the equator-ish


def test_nearby_stops_respects_radius(db):
    # Katpadi Junction is ~10 m away; Chittoor Bus Stand ~570 m; CMC ~5 km.
    near = stops_within(db, 12.9717, 79.1377, 300)
    assert [s.name for s in near] == ["Katpadi Junction"]
    wider = stops_within(db, 12.9717, 79.1377, 800)
    assert "Katpadi Chittoor Bus Stand" in [s.name for s in wider]
    assert all(s.distance_m <= 800 for s in wider)
    assert wider == sorted(wider, key=lambda s: s.distance_m)


def test_nearby_endpoint_validates(client, commuter_headers):
    r = client.get("/stops/nearby?lat=12.97&lon=79.14&radius_m=600", headers=commuter_headers)
    assert r.status_code == 200
    assert client.get("/stops/nearby?lat=200&lon=79.14", headers=commuter_headers).status_code == 422


def test_route_search(client, commuter_headers):
    r = client.get("/routes/search?source=katpadi&destination=cmc", headers=commuter_headers)
    assert [x["name"] for x in r.json()] == ["R1 Katpadi - Vellore CMC"]
    r = client.get("/routes/search?source=gandhi&destination=green", headers=commuter_headers)
    assert len(r.json()) == 2  # R1 and R2 both serve Gandhi Nagar -> Green Circle


# ---------- Alert thresholds ----------
def test_arrival_threshold_rule():
    assert should_send_arrival(4.9, 5, False)
    assert should_send_arrival(5.0, 5, False)
    assert not should_send_arrival(5.1, 5, False)
    assert not should_send_arrival(1.0, 5, True)


def test_delay_threshold_rule_with_hysteresis():
    assert delay_alert_state(15, 10, False) == (True, True)
    assert delay_alert_state(10, 10, False) == (False, False)  # must exceed, not equal
    assert delay_alert_state(8, 10, True) == (False, True)  # still above half: stay quiet
    assert delay_alert_state(4, 10, True) == (False, False)  # re-armed


def _fake_eta(eta_min: float, hold: float = 0.0):
    def fn(bus_id, stop_id, when):
        return EtaResult(eta_min, 1000, 20, 1.0, hold, 0.8, "heuristic")
    return fn


def test_alert_engine_sends_arrival_once(db):
    user = db.scalar(select(User).where(User.email == "arun@mail.com"))
    db.add(AlertSubscription(user_id=user.id, bus_id=1, stop_id=1, minutes_before=5))
    db.commit()
    engine = AlertEngine()
    assert engine.check(db, WHEN, _fake_eta(7)) == 0
    assert engine.check(db, WHEN, _fake_eta(4.5)) == 1
    assert engine.check(db, WHEN, _fake_eta(3)) == 0  # one-shot
    notes = db.scalars(select(Notification).where(Notification.user_id == user.id)).all()
    assert [n.type for n in notes] == ["ARRIVAL"]


def test_alert_engine_delay_for_subscribers_and_trips(db):
    user = db.scalar(select(User).where(User.email == "arun@mail.com"))
    db.add(AlertSubscription(user_id=user.id, bus_id=1, stop_id=1, minutes_before=2))
    db.add(Trip(user_id=user.id, bus_id=1, route_id=1, board_stop_id=1, status="ONGOING"))
    db.commit()
    engine = AlertEngine()
    assert engine.check(db, WHEN, _fake_eta(30, hold=15)) == 2  # subscriber + trip rider
    assert engine.check(db, WHEN, _fake_eta(29, hold=15)) == 0  # no repeats
    types = [n.type for n in db.scalars(select(Notification).where(Notification.user_id == user.id))]
    assert types == ["DELAY", "DELAY"]


# ---------- Favourites / notifications API ----------
def test_favourites_crud(client, commuter_headers):
    h = commuter_headers
    r = client.post("/favourites", json={"type": "ROUTE", "route_id": 1}, headers=h)
    assert r.status_code == 201
    assert client.post("/favourites", json={"type": "ROUTE", "route_id": 1}, headers=h).status_code == 409
    assert client.post("/favourites", json={"type": "STOP"}, headers=h).status_code == 422
    assert client.post("/favourites", json={"type": "STOP", "stop_id": 2}, headers=h).status_code == 201
    assert len(client.get("/favourites", headers=h).json()) == 2
    assert client.delete(f"/favourites/{r.json()['id']}", headers=h).status_code == 204
    assert len(client.get("/favourites", headers=h).json()) == 1


def test_subscribe_and_notifications_inbox(client, commuter_headers):
    h = commuter_headers
    r = client.post("/alerts/subscribe", json={"bus_id": 1, "stop_id": 1, "minutes_before": 5}, headers=h)
    assert r.status_code == 201
    assert len(client.get("/alerts", headers=h).json()) == 1
    page = client.get("/notifications?page=1&size=5", headers=h).json()
    assert page["page"] == 1 and page["size"] == 5 and page["total"] == 0
