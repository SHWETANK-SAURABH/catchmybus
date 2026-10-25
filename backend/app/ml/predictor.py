"""Prediction facade for crowd level and delay.

Loads the trained scikit-learn models from models/*.joblib when they exist; otherwise
falls back to the hand-written patterns so the app still works before `make train`.
Every result says which one was used ("model" or "heuristic").
"""
import logging
from pathlib import Path

import joblib

from ..config import get_settings
from . import patterns

log = logging.getLogger("catchmybus.ai")

CROWD_FEATURES = ["hour", "day_of_week", "route_id", "stop_seq", "is_peak", "weather_factor"]
DELAY_FEATURES = ["hour", "day_of_week", "route_id", "segment_distance", "recent_speed", "traffic_factor"]


class Predictor:
    def __init__(self):
        self.crowd_model = None
        self.delay_model = None
        self.loaded = False

    def load(self):
        """(Re)load model files from MODELS_DIR; missing files leave the heuristic in place."""
        d = Path(get_settings().models_dir)
        self.crowd_model = self._try_load(d / "crowd.joblib")
        self.delay_model = self._try_load(d / "delay.joblib")
        self.loaded = True

    @staticmethod
    def _try_load(path: Path):
        if not path.exists():
            log.warning(f"model file missing, using heuristic: {path.name}")
            return None
        try:
            return joblib.load(path)
        except Exception:
            log.exception(f"could not load {path.name}")
            return None

    def _ensure(self):
        if not self.loaded:
            self.load()

    def crowd(self, hour: int, day_of_week: int, route_id: int, stop_seq: int,
              weather_factor: float = 1.0) -> tuple[str, dict[str, float], str]:
        """Return (level, class probabilities, source) for the given conditions."""
        self._ensure()
        if self.crowd_model is not None:
            row = [[hour, day_of_week, route_id, stop_seq, patterns.is_peak(hour, day_of_week), weather_factor]]
            proba = self.crowd_model.predict_proba(row)[0]
            probs = {str(c): round(float(p), 3) for c, p in zip(self.crowd_model.classes_, proba)}
            return max(probs, key=probs.get), probs, "model"
        level = patterns.crowd_level(patterns.load_fraction(hour, day_of_week, route_id, stop_seq, weather_factor))
        return level, {lv: (1.0 if lv == level else 0.0) for lv in patterns.LEVELS}, "heuristic"

    def delay(self, hour: int, day_of_week: int, route_id: int, segment_distance: float,
              recent_speed: float, traffic_factor: float = 1.0) -> tuple[float, str]:
        """Return (predicted delay in minutes, source)."""
        self._ensure()
        if self.delay_model is not None:
            row = [[hour, day_of_week, route_id, segment_distance, recent_speed, traffic_factor]]
            return max(0.0, float(self.delay_model.predict(row)[0])), "model"
        return patterns.expected_delay(hour, day_of_week, route_id, segment_distance,
                                       recent_speed, traffic_factor), "heuristic"


predictor = Predictor()
