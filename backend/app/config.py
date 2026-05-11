from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Required (will crash at startup if missing from .env) ────────────────
    DATABASE_URL: str = Field(..., description="PostgreSQL async URL")
    SECRET_KEY: str = Field(..., min_length=32, description="JWT secret — must be 32+ chars")
    FERNET_KEY: str = Field(..., description="Fernet encryption key for credentials")

    # ── Optional with safe defaults ──────────────────────────────────────────
    REDIS_URL: str = "redis://redis:6379/0"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # ── LLM Configuration ─────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    LLM_FALLBACK_ENABLED: bool = True

    # ── Legacy (kept until Phase 2 migration complete) ─────────────────────────
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL: str = "openai/gpt-4o-mini"

    # ── Proxy Configuration ───────────────────────────────────────────────────
    PROXY_DATACENTER_URLS: str = ""  # Comma-separated list of datacenter proxy URLs
    PROXY_RESIDENTIAL_URL: str = ""
    PROXY_RESIDENTIAL_USER: str = ""
    PROXY_RESIDENTIAL_PASS: str = ""
    PROXY_ENABLED: bool = False

    # ── Neko Cloud Browser ─────────────────────────────────────────────────────
    NEKO_IMAGE: str = "jobblitz/neko:latest"
    NEKO_SESSION_TTL_MINUTES: int = 10
    LOGIN_HOST: str = "localhost"

    # ── App Version ─────────────────────────────────────────────────────────────
    VERSION: str = "1.0.0"
    UPLOAD_DIR: str = "./uploads"
    SCREENSHOT_DIR: str = "./screenshots"
    MAX_APPLICATIONS_PER_HOUR: int = 20
    MAX_APPLICATIONS_PER_DAY: int = 100
    MIN_MATCH_SCORE_TO_APPLY: float = 0.3
    MIN_MATCH_SCORE_TO_SAVE: float = 0.2
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()

# Ensure directories exist
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.SCREENSHOT_DIR).mkdir(parents=True, exist_ok=True)
