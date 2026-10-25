"""Load test for the hot read paths (NFR01: p95 < 500 ms for /eta and /buses).

    pip install -r backend/requirements-dev.txt
    locust -f scripts/locustfile.py --headless -u 50 -r 10 -t 60s --host http://localhost:8000

Logs in once per run (POST /auth/login is rate limited) and shares the token.
Set LOAD_EMAIL / LOAD_PASSWORD to override the seeded commuter account.
"""
import os
import random

import requests
from locust import HttpUser, between, events, task

TOKEN = {"value": None}


@events.test_start.add_listener
def login(environment, **_):
    r = requests.post(f"{environment.host}/auth/login", json={
        "email": os.getenv("LOAD_EMAIL", "arun@mail.com"),
        "password": os.getenv("LOAD_PASSWORD", os.getenv("SEED_COMMUTER_PASSWORD", "")),
    }, timeout=10)
    r.raise_for_status()
    TOKEN["value"] = r.json()["access_token"]


class Commuter(HttpUser):
    wait_time = between(0.5, 1.5)

    def on_start(self):
        self.client.headers["Authorization"] = f"Bearer {TOKEN['value']}"
        # Only (bus, stop) pairs where the stop is on the bus's route.
        stops = {r["id"]: [s["stop"]["id"] for s in r["stops"]] for r in self.client.get("/routes/all/detail").json()}
        self.pairs = [(b["id"], st) for b in self.client.get("/buses").json() for st in stops.get(b["route_id"], [])]

    @task(4)
    def eta(self):
        bus_id, stop_id = random.choice(self.pairs)
        self.client.get(f"/eta?bus_id={bus_id}&stop_id={stop_id}", name="/eta")

    @task(3)
    def buses(self):
        self.client.get("/buses")

    @task(3)
    def live(self):
        self.client.get("/buses/live")

    @task(1)
    def nearby(self):
        self.client.get("/stops/nearby?lat=12.959&lon=79.1385&radius_m=800", name="/stops/nearby")
