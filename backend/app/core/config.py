"""Application settings, loaded from the project's .env file."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py -> repo root (4 levels up)
ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ENVIRONMENT: str = "development"
    PORT: int = 8000

    # Async SQLAlchemy connection string, e.g.
    # postgresql+asyncpg://user:password@localhost:5432/fasalsetu
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/fasalsetu"

    # Origin of the Next.js frontend — used for the CORS allow-list.
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    # External API keys used by app/integrations/
    WEATHER_API_KEY: str | None = None
    SATELLITE_API_KEY: str | None = None
    AI_API_KEY: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
