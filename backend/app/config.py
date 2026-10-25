"""Application settings, read from environment variables / .env (no hardcoded secrets)."""
import logging
import secrets
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(REPO_DIR / ".env"), str(BACKEND_DIR / ".env")),
        extra="ignore",
    )

    database_url: str = "sqlite:///./catchmybus.db"
    # Empty means "not configured": a random per-process secret is generated (see below).
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720

    timezone: str = "Asia/Kolkata"
    frontend_origin: str = "http://localhost:5173"
    login_rate_limit_per_min: int = 10

    simulator_enabled: bool = True
    sim_tick_seconds: float = 2.0
    sim_history_every_seconds: float = 10.0
    sim_speed_multiplier: float = 1.0
    sim_random_delays: bool = True

    delay_alert_threshold_min: float = 10.0
    alert_check_seconds: float = 5.0

    seed_admin_email: str = "admin@catchmybus.com"
    seed_admin_password: str = ""
    seed_commuter_email: str = "arun@mail.com"
    seed_commuter_password: str = ""

    # Best-route weights (score = lower is better)
    w_eta: float = 1.0
    w_walk: float = 0.02  # per metre of walking -> ~1 point per 50 m
    w_crowd: float = 4.0
    w_delay_risk: float = 0.5

    models_dir: str = str(BACKEND_DIR / "models")
    seed_dir: str = str(BACKEND_DIR / "seed")


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if not s.jwt_secret:
        logging.getLogger("catchmybus").warning(
            "JWT_SECRET not set - using a random secret; tokens reset on restart"
        )
        s.jwt_secret = secrets.token_hex(32)
    return s
