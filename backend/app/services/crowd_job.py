"""Periodic job: store a crowd prediction per live bus once a minute (feeds analytics)."""
import asyncio
import time

from ..clock import now_local
from ..db import SessionLocal
from ..ml.predictor import predictor
from ..models import CrowdPrediction

INTERVAL_S = 60


class CrowdJob:
    def __init__(self):
        self._last = 0.0

    async def __call__(self, sim):
        if time.monotonic() - self._last < INTERVAL_S:
            return
        self._last = time.monotonic()
        await asyncio.to_thread(self.run_once, sim)

    def run_once(self, sim) -> int:
        now = now_local()
        with sim.lock:
            buses = [(st.bus_id, st.route_id,
                      next((s.seq for s in st.geom.stops if s.stop_id == st.next_stop_id), 0))
                     for st in sim.buses.values()]
        with SessionLocal() as db:
            for bus_id, route_id, seq in buses:
                level, _p, _s = predictor.crowd(now.hour, now.weekday(), route_id, seq)
                db.add(CrowdPrediction(bus_id=bus_id, level=level))
            db.commit()
        return len(buses)


crowd_job = CrowdJob()
