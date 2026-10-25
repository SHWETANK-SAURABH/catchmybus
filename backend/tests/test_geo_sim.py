"""Unit tests for geometry math and the GPS simulator."""
import pytest

from app.cache import InMemoryCache
from app.geo import bearing_deg, cumulative_distances, haversine_m, point_at_distance
from app.simulator import Simulator


def test_haversine_known_distance():
    # Katpadi Junction -> CMC Hospital is roughly 5.2 km in a straight line.
    d = haversine_m(12.9716, 79.1376, 12.9246, 79.1356)
    assert 5100 < d < 5300
    assert haversine_m(12.97, 79.13, 12.97, 79.13) == 0


def test_haversine_one_degree_latitude():
    assert haversine_m(0, 0, 1, 0) == pytest.approx(111_195, rel=1e-3)


def test_bearing_cardinal_directions():
    assert bearing_deg(0, 0, 1, 0) == pytest.approx(0, abs=0.01)
    assert bearing_deg(0, 0, 0, 1) == pytest.approx(90, abs=0.01)
    assert bearing_deg(1, 0, 0, 0) == pytest.approx(180, abs=0.01)


def test_point_at_distance_interpolates_and_clamps():
    pts = [(0.0, 0.0), (0.0, 0.01), (0.01, 0.01)]
    cum = cumulative_distances(pts)
    mid, heading = point_at_distance(pts, cum, cum[1] / 2)
    assert mid == pytest.approx((0.0, 0.005), abs=1e-9)
    assert heading == pytest.approx(90, abs=0.1)
    assert point_at_distance(pts, cum, -50)[0] == pts[0]
    assert point_at_distance(pts, cum, cum[-1] + 50)[0] == pytest.approx(pts[-1])


def test_simulator_moves_buses_and_writes_cache(db):
    sim = Simulator(InMemoryCache(), seed=1)
    sim.sync_with_db(db)
    assert len(sim.buses) == 6
    before = {b: st.s for b, st in sim.buses.items()}
    for _ in range(10):
        sim.tick(2.0)
    moved = [b for b, st in sim.buses.items() if st.s != before[b]]
    assert moved, "at least one bus should have moved"
    pos = sim.cache.get_position(moved[0])
    assert pos and {"lat", "lon", "heading", "speed_kmh", "load"} <= pos.keys()


def test_simulator_stays_on_route_and_turns_around(db):
    sim = Simulator(InMemoryCache(), seed=2)
    sim.sync_with_db(db)
    directions = set()
    for _ in range(2000):  # over an hour of simulated time
        sim.tick(2.0)
        for st in sim.buses.values():
            assert 0 <= st.s <= st.geom.length_m + 1e-6
            if not st.geom.is_loop:
                directions.add(st.direction)
    assert directions == {1, -1}


def test_inject_delay(db):
    sim = Simulator(InMemoryCache(), seed=3)
    sim.sync_with_db(db)
    bus_id = next(iter(sim.buses))
    assert sim.inject_delay(bus_id, 15)
    pos_before = sim.buses[bus_id].s
    sim.tick(2.0)
    assert sim.buses[bus_id].s == pos_before  # held in place
    assert sim.cache.get_position(bus_id)["delay_min"] == pytest.approx(15, abs=0.1)
    assert not sim.inject_delay(9999, 5)
