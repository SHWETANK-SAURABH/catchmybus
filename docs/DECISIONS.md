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
