"""Generate the SYNTHETIC training dataset for the crowd and delay models (~50k rows).

Nothing here is real ridership data. Rows are drawn from the hand-written patterns in
backend/app/ml/patterns.py (weekday peaks 8-10 and 17-19, weekend dips, route popularity,
rain and traffic) plus random noise, so the models have something realistic to learn.

Usage (from the repo root or backend/):  python scripts/generate_data.py [--rows 50000]
"""
import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

from app.ml import patterns  # noqa: E402

OUT = BACKEND / "ml_data" / "synthetic_trips.csv"

# Service hours 05-23 with more samples in busy hours (mirrors when trips actually happen).
HOURS = np.arange(5, 23)


def generate(rows: int, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    hour_w = np.array([patterns.hourly_demand(h, 0) + 0.2 for h in HOURS])
    hour = rng.choice(HOURS, size=rows, p=hour_w / hour_w.sum())
    dow = rng.integers(0, 7, rows)
    route = rng.integers(1, 4, rows)
    stop_seq = rng.integers(0, 9, rows)
    is_peak = np.array([patterns.is_peak(h, d) for h, d in zip(hour, dow)])
    rain = rng.random(rows) < 0.2
    weather = np.where(rain, rng.uniform(1.15, 1.4, rows), 1.0).round(2)

    # ----- crowd label -----
    frac = np.array([patterns.load_fraction(h, d, r, s, w)
                     for h, d, r, s, w in zip(hour, dow, route, stop_seq, weather)])
    frac = frac * rng.lognormal(0, 0.12, rows) + rng.normal(0, 0.06, rows)
    crowd = np.array([patterns.crowd_level(f) for f in frac])
    flip = rng.random(rows) < 0.04  # a little label noise (miscounts)
    crowd[flip] = rng.choice(patterns.LEVELS, flip.sum())

    # ----- delay target -----
    traffic = (rng.uniform(0.8, 1.2, rows) + 0.25 * is_peak + 0.2 * rain).round(2)
    segment = rng.uniform(200, 8000, rows).round(0)
    speed = np.clip(rng.normal(26 - 7 * is_peak - 4 * rain, 4, rows), 5, 40).round(1)
    delay = np.array([patterns.expected_delay(h, d, r, g, v, t)
                      for h, d, r, g, v, t in zip(hour, dow, route, segment, speed, traffic)])
    delay = np.clip(delay + rng.normal(0, 0.3 + 0.08 * segment / 1000, rows), 0, None).round(2)

    return pd.DataFrame({
        "hour": hour, "day_of_week": dow, "route_id": route, "stop_seq": stop_seq,
        "is_peak": is_peak, "weather_factor": weather, "crowd_level": crowd,
        "segment_distance": segment, "recent_speed": speed, "traffic_factor": traffic,
        "delay_min": delay,
    })


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--rows", type=int, default=50_000)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args(argv)
    df = generate(args.rows)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.out, index=False)
    print(f"wrote {len(df)} synthetic rows -> {args.out}")
    print(df["crowd_level"].value_counts(normalize=True).round(3).to_string())


if __name__ == "__main__":
    main()
