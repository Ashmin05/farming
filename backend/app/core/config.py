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

    # Secret used to sign JWTs. Override with a random value in every real environment.
    JWT_SECRET_KEY: str = "dev-only-insecure-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # OAuth client ID from Google Cloud Console — used to verify "Sign in with
    # Google" ID tokens. Must match the frontend's NEXT_PUBLIC_GOOGLE_CLIENT_ID.
    GOOGLE_CLIENT_ID: str | None = None

    # External API keys used by app/integrations/
    WEATHER_API_KEY: str | None = None
    SATELLITE_API_KEY: str | None = None
    AI_API_KEY: str | None = None

    # Google Earth Engine (app/integrations/earth_engine_client.py).
    # GEE_PROJECT_ID is always required. GEE_SERVICE_ACCOUNT_EMAIL/
    # GEE_KEY_PATH are optional — set both for production (a service-account
    # key); leave both blank for local dev, where the client instead uses
    # Application Default Credentials from `gcloud auth application-default
    # login` (works even when an org policy blocks service-account key
    # creation). If GEE_PROJECT_ID itself is missing, the client just stays
    # "not configured" and the rest of the API still starts normally.
    GEE_PROJECT_ID: str | None = None
    GEE_SERVICE_ACCOUNT_EMAIL: str | None = None
    GEE_KEY_PATH: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
