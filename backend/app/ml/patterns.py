"""Hand-written demand/delay patterns.

These functions describe how crowding and delays *roughly* behave in a city bus network
(weekday peaks, weekend dips, rain/traffic). They are used in three places:
  1. scripts/generate_data.py   - to create the SYNTHETIC training dataset (plus noise)
  2. the GPS simulator          - to give each bus a time-of-day passenger load
  3. the predictor              - as a fallback when no trained model file exists
The models learn these patterns back from noisy data; nothing here is real ridership data.
"""

# Relative popularity per route (route ids 1..3 in the seed data; others wrap around).
ROUTE_POPULARITY = [1.0, 1.25, 0.7]

LEVELS = ["LOW", "MEDIUM", "HIGH"]


def route_popularity(route_id: int) -> float:
    return ROUTE_POPULARITY[(route_id - 1) % len(ROUTE_POPULARITY)]


def is_peak(hour: int, day_of_week: int) -> int:
    """1 if the hour is a weekday morning (8-10) or evening (17-19) peak, else 0."""
    weekday = day_of_week < 5
    return int(weekday and (8 <= hour < 10 or 17 <= hour < 19))


def hourly_demand(hour: int, day_of_week: int) -> float:
    """Base demand factor (0..1) for an hour of the day.

    Weekdays have two strong peaks; weekends are flatter and lower (about 60%).
    """
    if hour < 5 or hour >= 23:
        base = 0.05
    elif is_peak(hour, day_of_week):
        base = 0.9
    elif hour in (7, 10, 16, 19):  # shoulders around the peaks
        base = 0.6
    elif 11 <= hour <= 15:
        base = 0.35
    else:
        base = 0.25
    if day_of_week >= 5:  # weekend dip, with a small midday bump
        base = base * 0.55 + (0.1 if 11 <= hour <= 18 else 0.0)
    return base


def load_fraction(hour: int, day_of_week: int, route_id: int, stop_seq: int,
                  weather_factor: float = 1.0) -> float:
    """Expected bus load as a fraction of capacity (can exceed 1.0 when overcrowded).

    Middle stops of a route are busier than the ends; rain (weather_factor > 1)
    pushes people from walking/two-wheelers onto buses.
    """
    mid_bonus = 0.12 if 1 <= stop_seq <= 5 else 0.0
    return hourly_demand(hour, day_of_week) * route_popularity(route_id) * weather_factor + mid_bonus


def crowd_level(fraction: float) -> str:
    """Map a load fraction to LOW (<45%), MEDIUM (<80%) or HIGH."""
    if fraction < 0.45:
        return "LOW"
    if fraction < 0.8:
        return "MEDIUM"
    return "HIGH"


def expected_delay(hour: int, day_of_week: int, route_id: int, segment_distance_m: float,
                   recent_speed_kmh: float, traffic_factor: float = 1.0) -> float:
    """Expected extra delay in minutes over the remaining `segment_distance_m`.

    Per km still to drive:  (0.2 + 0.8 * demand) * traffic  +  1.5 * slow_penalty
    where demand is the peak-hour/route factor and slow_penalty is how far the bus's
    recent speed is below the 25 km/h planning speed (0..1). Zero distance -> zero delay,
    so an ETA converges to 0 as the bus arrives.
    """
    demand = hourly_demand(hour, day_of_week) * route_popularity(route_id)
    km = segment_distance_m / 1000.0
    slow_penalty = max(0.0, (25.0 - recent_speed_kmh) / 25.0)  # 0 when at/above planning speed
    delay = km * ((0.2 + 0.8 * demand) * traffic_factor + 1.5 * slow_penalty)
    return max(0.0, delay)
