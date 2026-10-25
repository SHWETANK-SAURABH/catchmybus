"""AI module: scoring math, demo-time parsing, crowd/delay endpoints, metrics (FR16-FR18)."""
from datetime import datetime

import pytest

from app.clock import parse_demo_time
from app.ml import patterns
from app.ml.best_route import Weights, ride_distance_m, ride_minutes, score_option

SUNDAY = datetime(2026, 10, 25, 11, 0)


def test_parse_demo_time_weekday_and_named_day():
    t = parse_demo_time("08:30", SUNDAY)
    assert (t.weekday(), t.hour, t.minute) == (0, 8, 30)  # Sunday -> Monday 08:30
    weekday = datetime(2026, 10, 28, 11, 0)  # Wednesday stays Wednesday
    assert parse_demo_time("14:00", weekday).date() == weekday.date()
    sat = parse_demo_time("Sat 12:00", weekday)
    assert (sat.weekday(), sat.hour) == (5, 12)
    assert parse_demo_time("garbage", weekday) == weekday
    assert parse_demo_time(None, weekday) == weekday


def test_patterns_peak_and_levels():
    assert patterns.is_peak(8, 0) == 1 and patterns.is_peak(14, 0) == 0 and patterns.is_peak(8, 6) == 0
    assert patterns.crowd_level(0.2) == "LOW"
    assert patterns.crowd_level(0.6) == "MEDIUM"
    assert patterns.crowd_level(0.95) == "HIGH"
    assert patterns.expected_delay(8, 0, 2, 0, 20) == 0  # nothing left to drive -> no delay
    assert patterns.expected_delay(8, 0, 2, 5000, 15) > patterns.expected_delay(14, 0, 2, 5000, 25)


def test_ride_distance_loop_and_linear():
    assert ride_distance_m(1000, 3000, 5000, False) == 2000
    assert ride_distance_m(3000, 1000, 5000, False) == 2000
    assert ride_distance_m(4000, 1000, 5000, True) == 2000  # wraps forward round the loop
    assert ride_minutes(2000) == pytest.approx(6.0)  # 2 km at 20 km/h


def test_score_option_breakdown_sums():
    w = Weights(eta=1.0, walk=0.02, crowd=4.0, delay_risk=0.5)
    score, b = score_option(wait_min=5, ride_min=10, walk_m=250, crowd_level="HIGH", delay_min=4, w=w)
    assert b == {"eta": 15.0, "walk": 5.0, "crowd": 10.0, "delay_risk": 2.0}
    assert score == 32.0
    # no live bus -> assumed 30 min wait; LOW crowd costs nothing
    score2, b2 = score_option(None, 10, 0, "LOW", 0, w)
    assert b2["eta"] == 40.0 and b2["crowd"] == 0 and score2 == 40.0


def test_crowd_differs_peak_vs_afternoon(client, commuter_headers):
    def level(t):
        h = {**commuter_headers, "X-Demo-Time": t}
        return {c["bus_id"]: c["level"] for c in client.get("/ai/crowd/all", headers=h).json()}

    peak, afternoon = level("08:30"), level("14:00")
    assert len(peak) == 6
    assert "HIGH" in peak.values()
    assert peak != afternoon
    assert list(afternoon.values()).count("HIGH") < list(peak.values()).count("HIGH")


def test_crowd_endpoint_shape(client, commuter_headers):
    r = client.get("/ai/crowd?bus_id=1", headers=commuter_headers)
    body = r.json()
    assert r.status_code == 200 and body["level"] in ("LOW", "MEDIUM", "HIGH")
    assert body["source"] in ("model", "heuristic")
    assert abs(sum(body["probabilities"].values()) - 1) < 0.01
    assert client.get("/ai/crowd?bus_id=999", headers=commuter_headers).status_code == 404


def test_delay_includes_injected_hold(client, admin_headers, commuter_headers):
    before = client.get("/ai/delay?bus_id=1", headers=commuter_headers).json()
    client.post("/admin/sim/delay", json={"bus_id": 1, "minutes": 15}, headers=admin_headers)
    after = client.get("/ai/delay?bus_id=1", headers=commuter_headers).json()
    assert after["injected_delay_min"] == 15
    assert after["total_delay_min"] == pytest.approx(after["predicted_delay_min"] + 15, abs=0.01)
    assert after["total_delay_min"] > before["total_delay_min"]


def test_best_route_ranks_with_breakdown(client, commuter_headers):
    r = client.get("/ai/best-route?source=Gandhi Nagar&destination=Green Circle", headers=commuter_headers)
    assert r.status_code == 200
    opts = r.json()["options"]
    assert len(opts) >= 2
    assert [o["score"] for o in opts] == sorted(o["score"] for o in opts)
    for o in opts:
        assert o["score"] == pytest.approx(sum(o["breakdown"].values()), abs=0.05)
    # custom weights are applied and echoed back
    r2 = client.get("/ai/best-route?source=Gandhi Nagar&destination=Green Circle&w_crowd=0",
                    headers=commuter_headers).json()
    assert r2["weights"]["crowd"] == 0 and all(o["breakdown"]["crowd"] == 0 for o in r2["options"])
