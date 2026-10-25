"""Train the crowd classifier and delay regressor on the synthetic dataset.

    python -m app.ml.train              # (re)generate data if needed, train, save
    python -m app.ml.train --if-missing # only train when model files are absent

Outputs models/crowd.joblib, models/delay.joblib and models/metrics.json.
"""
import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

from ..config import BACKEND_DIR, get_settings
from .patterns import LEVELS
from .predictor import CROWD_FEATURES, DELAY_FEATURES

DATA = BACKEND_DIR / "ml_data" / "synthetic_trips.csv"
GENERATOR = BACKEND_DIR.parent / "scripts" / "generate_data.py"


def ensure_data() -> pd.DataFrame:
    if not DATA.exists():
        subprocess.run([sys.executable, str(GENERATOR)], check=True)
    return pd.read_csv(DATA)


def train_crowd(df: pd.DataFrame) -> tuple[RandomForestClassifier, dict]:
    X, y = df[CROWD_FEATURES].to_numpy(), df["crowd_level"].to_numpy()
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    model = RandomForestClassifier(n_estimators=150, max_depth=12, min_samples_leaf=5, n_jobs=-1, random_state=42)
    model.fit(X_tr, y_tr)
    pred = model.predict(X_te)
    report = classification_report(y_te, pred, labels=LEVELS, output_dict=True, zero_division=0)
    return model, {
        "model": "RandomForestClassifier(n_estimators=150, max_depth=12)",
        "features": CROWD_FEATURES,
        "test_rows": int(len(y_te)),
        "accuracy": round(float(accuracy_score(y_te, pred)), 4),
        "labels": LEVELS,
        "confusion_matrix": confusion_matrix(y_te, pred, labels=LEVELS).tolist(),
        "f1_per_class": {lv: round(report[lv]["f1-score"], 4) for lv in LEVELS},
        "feature_importance": dict(zip(CROWD_FEATURES, np.round(model.feature_importances_, 4).tolist())),
    }


def train_delay(df: pd.DataFrame) -> tuple[GradientBoostingRegressor, dict]:
    X, y = df[DELAY_FEATURES].to_numpy(), df["delay_min"].to_numpy()
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)
    model = GradientBoostingRegressor(n_estimators=200, max_depth=4, learning_rate=0.1, random_state=42)
    model.fit(X_tr, y_tr)
    pred = model.predict(X_te)
    return model, {
        "model": "GradientBoostingRegressor(n_estimators=200, max_depth=4)",
        "features": DELAY_FEATURES,
        "test_rows": int(len(y_te)),
        "mae_min": round(float(mean_absolute_error(y_te, pred)), 4),
        "r2": round(float(r2_score(y_te, pred)), 4),
        # Honest baseline: always predicting the training mean.
        "baseline_mae_min": round(float(mean_absolute_error(y_te, np.full_like(y_te, y_tr.mean()))), 4),
        "feature_importance": dict(zip(DELAY_FEATURES, np.round(model.feature_importances_, 4).tolist())),
    }


def train_all() -> dict:
    out = Path(get_settings().models_dir)
    out.mkdir(parents=True, exist_ok=True)
    df = ensure_data()
    crowd_model, crowd_metrics = train_crowd(df)
    delay_model, delay_metrics = train_delay(df)
    joblib.dump(crowd_model, out / "crowd.joblib", compress=3)
    joblib.dump(delay_model, out / "delay.joblib", compress=3)
    metrics = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataset": {"rows": int(len(df)), "synthetic": True, "file": DATA.name},
        "crowd": crowd_metrics,
        "delay": delay_metrics,
    }
    (out / "metrics.json").write_text(json.dumps(metrics, indent=2))
    return metrics


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--if-missing", action="store_true", help="skip if model files already exist")
    args = ap.parse_args(argv)
    out = Path(get_settings().models_dir)
    if args.if_missing and (out / "crowd.joblib").exists() and (out / "delay.joblib").exists():
        print("models present - skipping training")
        return
    m = train_all()
    print(f"crowd accuracy={m['crowd']['accuracy']}  delay MAE={m['delay']['mae_min']} min  R2={m['delay']['r2']}")
    print("confusion matrix (rows=true, cols=pred, order LOW/MEDIUM/HIGH):")
    for row in m["crowd"]["confusion_matrix"]:
        print("   ", row)


if __name__ == "__main__":
    main()
