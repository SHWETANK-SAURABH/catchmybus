# Test report

**Run date:** 2026-10-25. **Environment:** Windows 11, Python 3.11.15, Node 24, SQLite (in-memory for tests).

| Suite | Command | Result |
|---|---|---|
| Backend (pytest) | `cd backend && pytest` | **69 passed**, 0 failed |
| Frontend (Vitest) | `cd frontend && npm test` | **7 passed**, 0 failed |
| AI tests without trained models (heuristic fallback) | `MODELS_DIR=<empty dir> pytest tests/test_ai.py` | 8 passed |
| Load test (Locust, 50 users, 60 s) | `make loadtest` | 2732 requests, **0 failures**, p95 /eta 28 ms, /buses 43 ms ([report](screenshots/21-load-test-locust.png)) |

> **Note on IDs:** the FT/NFT numbering below follows the order of the requirements in the
> project spec. Please check it against the test-case IDs in the Lab VII document and
> renumber where they differ. The mapping from requirement to test does not change.

## Functional tests (FT)

| ID | Requirement | Test case | Automated test(s) | Result |
|---|---|---|---|---|
| FT01 | FR01 Register | Valid registration returns a JWT and creates a COMMUTER; duplicate email → 409; invalid input → 422 | `test_auth.py::test_register_creates_commuter_with_bcrypt_hash`, `test_register_duplicate_email_conflict`, `test_register_validates_input` | Pass |
| FT02 | FR02 Login | Correct credentials → token and `/auth/me`; wrong password → 401; bad/missing token → 401 | `test_login_and_me`, `test_login_wrong_password`, `test_me_requires_valid_token` | Pass |
| FT02b | Skip sign-in (guest) | Off by default (404); when enabled, each call creates a separate COMMUTER, guests' favourites aren't shared, guests get 403 on /admin; the login page shows the Skip sign-in button when enabled | `test_guest_login_disabled_by_default`, `test_guest_login_creates_separate_commuters`, Vitest "Login shortcuts" | Pass |
| FT02a | Demo sign-in | Off by default (404); when enabled, signs in only the seeded commuter/admin; invalid role → 422 | `test_demo_login_disabled_by_default`, `test_demo_login_signs_in_seeded_accounts` | Pass |
| FT03 | FR28 Role-based access | A commuter gets **403** on every `/admin` GET and write; anonymous → 401 | `test_admin.py::test_commuter_gets_403_on_admin_endpoints` (10 endpoints), `test_commuter_cannot_write_admin`, `test_anonymous_gets_401` | Pass |
| FT04 | FR06/FR10 Live tracking | Buses move along the route, stay on the polyline and turn round at the ends; positions reach the cache | `test_geo_sim.py::test_simulator_moves_buses_and_writes_cache`, `test_simulator_stays_on_route_and_turns_around` | Pass |
| FT05 | FR07 Route search | Katpadi → CMC finds R1; Gandhi Nagar → Green Circle finds R1 and R2 | `test_eta_alerts.py::test_route_search` | Pass |
| FT06 | FR08 Nearby stops | Only stops inside the radius, sorted by distance; invalid lat → 422 | `test_nearby_stops_respects_radius`, `test_nearby_endpoint_validates`, `test_bounding_box_contains_radius` | Pass |
| FT07 | FR09 ETA | Remaining-distance math for out-and-back and loop routes; speed floor; the ETA falls as the bus approaches; unknown stop → 404 | `test_remaining_distance_*`, `test_travel_minutes_and_speed_floor`, `test_confidence_drops_with_distance_and_holds`, `test_eta_endpoint_decreases_as_bus_approaches`, `test_eta_unknown_stop_is_404` | Pass |
| FT08 | FR13 Arrival alert | Fires once when ETA ≤ threshold, then the subscription closes | `test_arrival_threshold_rule`, `test_alert_engine_sends_arrival_once` | Pass |
| FT09 | FR14 Delay alert | Fires when delay > 10 min, does not repeat, re-arms below half the threshold; goes to subscribers and riders on an ongoing trip; a simulated 15-min delay produces a DELAY notification | `test_delay_threshold_rule_with_hysteresis`, `test_alert_engine_delay_for_subscribers_and_trips`, `test_admin.py::test_sim_delay_triggers_delay_alert` | Pass |
| FT10 | FR11/FR12 Favourites | Add a route/stop, duplicate → 409, missing id → 422, delete | `test_favourites_crud` | Pass |
| FT11 | FR16 Crowd prediction | Valid level and probabilities; more HIGH at weekday 08:30 than at 14:00 | `test_ai.py::test_crowd_endpoint_shape`, `test_crowd_differs_peak_vs_afternoon`, `test_patterns_peak_and_levels` | Pass |
| FT12 | FR18 Delay prediction | Total delay = model prediction + injected hold | `test_delay_includes_injected_hold` | Pass |
| FT13 | FR17 Best route | Options sorted by score; breakdown sums to the score; custom weights applied; scoring and ride-distance math | `test_best_route_ranks_with_breakdown`, `test_score_option_breakdown_sums`, `test_ride_distance_loop_and_linear` | Pass |
| FT14 | FR22 Trip history | Start/complete lifecycle, double complete → 409, date-range filter, other users' trips not visible | `test_trips_analytics.py::test_trip_lifecycle_and_history`, `test_trips_are_private` | Pass |
| FT15 | FR25 SOS | A commuter's SOS appears in the admin feed and notifies admins; admin can resolve it | `test_admin.py::test_sos_reaches_admin_feed` | Pass |
| FT16 | FR29-31 Admin CRUD | Create/update/delete with validation (422), not found (404), constraint violation (409), route-stop ordering, paginated lists | `test_admin_crud_writes_audit_log`, `test_admin_validation_errors`, `test_route_stop_add_and_remove`, `test_admin_list_is_paginated` | Pass |
| FT17 | Announcements | An admin post notifies commuters and appears in the public feed | `test_announcement_notifies_commuters` | Pass |
| FT18 | FR33 Analytics | Ridership by route and hour, crowd distribution, SOS counts; commuter → 403 | `test_analytics_shape` | Pass |
| FT19 | Demo time override | `HH:MM` maps to a weekday, `Sat 12:00` picks the day, invalid input is ignored | `test_parse_demo_time_weekday_and_named_day` | Pass |
| FT20 | UI | Labelled login fields; crowd badge shows text; time and distance formatting | `frontend/src/test/ui.test.tsx` (7 tests) | Pass |

## Non-functional tests (NFT)

| ID | Requirement | Test case | Evidence | Result |
|---|---|---|---|---|
| NFT01 | NFR01 Performance | p95 < 500 ms for /eta and /buses under 50 concurrent users | Locust: /eta p95 28 ms, /buses p95 43 ms, 0 failures ([report](screenshots/21-load-test-locust.png)) | Pass |
| NFT02 | NFR04 Password security | Stored hash is bcrypt (`$2…`), never the plain text | `test_register_creates_commuter_with_bcrypt_hash` | Pass |
| NFT03 | Brute-force protection | 6th login attempt within a minute → 429; the window expires | `test_login_rate_limited`, `test_rate_limiter_window_expires` | Pass |
| NFT04 | NFR14 Audit log | Every admin write is logged with admin id, timestamp and diff; a failed write leaves **no** audit row (same transaction); a simulated delay is audited | `test_admin_crud_writes_audit_log`, `test_failed_admin_write_leaves_no_audit_row`, `test_sim_delay_is_audited` | Pass |
| NFT05 | NFR09 Modularity | Each service is its own router; the cache sits behind `ICache` | Code structure ([backend/app/routers](../backend/app/routers), [cache.py](../backend/app/cache.py)) | Pass (inspection) |
| NFT06 | NFR13 Privacy | A consent dialog with a privacy note is shown before geolocation is requested | Manual: [screenshot](screenshots/12-location-consent.png), `NearbyStops.tsx` | Pass (manual) |
| NFT07 | NFR07/NFR10 Usability | Usable at 390 px width; dark theme follows the OS; labels, ARIA and a skip link on the main controls | Manual: [mobile screenshot](screenshots/08-mobile-home.png) | Pass (manual) |
| NFT08 | NFR12 Backup | `scripts/backup.sh` writes a timestamped dump and keeps the newest 7 | Ran against SQLite on 2026-10-25: `backups/catchmybus-20261025-180519.db` written | Pass |
| NFT09 | Availability / ops | `/health` returns ok; structured JSON logs per request | `test_health`, server logs | Pass |
| NFT10 | Real-time delivery | A 15-min simulated delay reaches the commuter's WebSocket in < 30 s; an SOS reaches the admin socket live | Manual E2E script on the running server: DELAY toast after **6.4 s**, SOS delivered to the admin socket | Pass |

## Acceptance criteria checklist

| Criterion | Status |
|---|---|
| `make up && make seed` starts everything with the demo accounts | Compose file and Makefile provided. Verified locally in the SQLite flow; the Docker daemon was not running on the build machine, so the Postgres stack was not executed. |
| Buses move; the ETA at a stop decreases as the bus approaches | Pass (FT04, FT07) |
| A 15-min simulated delay produces a delay alert within 30 s | Pass (NFT10: 6.4 s) |
| A 5-minute arrival alert fires at the right time | Pass (FT08) |
| Crowd differs at 08:30 vs 14:00 via the demo-time override | Pass (FT11) |
| Commuter gets 403 on /admin; admin edits appear in the audit log with timestamp and admin id | Pass (FT03, NFT04) |
| A commuter's SOS appears live in the admin console | Pass (FT15, NFT10) |
| pytest passes with ≥ 20 tests across auth, roles, ETA math, radius, alert thresholds, audit | Pass (69 tests) |
| Zero hardcoded secrets | Pass: secrets and passwords come only from `.env` |
