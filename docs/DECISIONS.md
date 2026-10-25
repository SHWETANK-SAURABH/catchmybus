# Design decisions

Where the spec left room, I picked the simplest reasonable option and wrote it down here.

| # | Decision | Why |
|---|----------|-----|
| D1 | `Base.metadata.create_all()` instead of Alembic migrations. | The schema is created fresh by `make seed`; migrations add moving parts without helping the demo. Alembic can be added later without model changes. |
| D2 | `route_stops` primary key is `(route_id, seq)`, not `(route_id, stop_id)`. | A loop route (R3) starts and ends at the same stop, so a stop can appear twice on one route. |
| D3 | `buses.route_id` column added. | The table list has no link between a bus and the route it runs; the simulator, ETA and crowd model all need one. |
| D4 | `bus_positions_history` has extra `delay_min` and `load` columns. | Lets the analytics dashboard compute "avg delay by route" and load figures from recorded data instead of inventing them. |
| D5 | `alert_subscriptions` table added. | `POST /alerts/subscribe` needs somewhere to persist the subscription; flags `arrival_sent`/`delay_sent` stop duplicate alerts. |
| D6 | Public `/auth/register` always creates a COMMUTER. | Prevents anyone from self-registering as ADMIN. Admin accounts are seeded. |
| D7 | Demo passwords are read from `.env` (`SEED_*_PASSWORD`), and a missing `JWT_SECRET` makes the server generate a random one at startup. | "Zero hardcoded secrets": nothing secret lives in source code. |
| D8 | The server seeds itself on first start if the database is empty; `make seed` always resets and reseeds. | `make up` alone gives a working demo; `make seed` gives a known clean state. |
| D9 | Light/dark theme follows the OS setting (`prefers-color-scheme`). | Meets NFR07 with no extra toggle state. |
| D10 | The admin "simulate delay" **holds the bus still** for N minutes; random delay events are **speed drops** (30% speed for 2-4 min). | A held bus makes the ETA count down consistently (travel time + remaining hold). If we only added N minutes on top, the ETA would read "15 min" while the bus pulled into the stop. |
| D11 | ETA = remaining distance along the route / smoothed speed (EMA incl. stops, floor 8 km/h) + remaining hold + model-predicted delay for the remaining distance. Confidence is a simple heuristic (distance, slow speed, holds). | Simple to explain in a viva. Delay is proportional to distance left, so the ETA reaches 0 on arrival. |
| D12 | `X-Demo-Time: HH:MM` means *that time on a weekday*; `Sat 12:00` style picks a day. | The demo must show peak vs off-peak even when it is presented on a weekend. |
| D13 | Best route covers **direct** buses only. Boarding at any stop within 800 m of the source is allowed and costs walking. Ride time uses a 20 km/h planning speed. When no bus is live, the wait is taken as 30 min. | Multi-modal and transfer journeys are out of scope. |
| D14 | Crowd model inputs at inference: the route of the bus, the seq of its next stop, weather "clear" (or `?weather=rain`). Predictions are stored once a minute per bus for analytics. | Uses only data the system really has. |
| D15 | Arrival subscriptions are one-shot: after the arrival alert they are deactivated. Delay alerts re-arm only once the delay drops below half the threshold. | Avoids notification spam. |
| D16 | Backend Docker image is built from the repo root. | `scripts/generate_data.py` must be available inside the container to train the models on first start. |
| D17 | One-click demo sign-in is a server endpoint (`POST /auth/demo-login {role}`) behind `DEMO_LOGIN_ENABLED`, not passwords pre-filled in the frontend. | Keeps "no hardcoded secrets": the browser bundle holds no credentials. It only reaches the two seeded accounts, shares the login rate limit, and is off unless enabled. |
