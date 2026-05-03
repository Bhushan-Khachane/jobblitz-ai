from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Required (will crash at startup if missing from .env) ────────────────
    DATABASE_URL: str = Field(..., description="PostgreSQL async URL")
    SECRET_KEY: str = Field(..., min_length=32, description="JWT secret — must be 32+ chars")
    FERNET_KEY: str = Field(..., description="Fernet encryption key for credentials")

    # ── Optional with safe defaults ──────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL: str = "openai/gpt-4o-mini"
    UPLOAD_DIR: str = "./uploads"
    SCREENSHOT_DIR: str = "./screenshots"
    MAX_APPLICATIONS_PER_HOUR: int = 20
    MAX_APPLICATIONS_PER_DAY: int = 100
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()

# Ensure directories exist
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.SCREENSHOT_DIR).mkdir(parents=True, exist_ok=True)
