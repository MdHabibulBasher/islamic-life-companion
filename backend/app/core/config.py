from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",          # silently ignore unknown env vars (JWT_SECRET, JWT_ALGORITHM)
        case_sensitive=False,    # JWT_SECRET and jwt_secret both map to JWT_SECRET
    )

    # Environment
    ENV: str = "development"

    # Database
    DATABASE_URL: str = "sqlite:///./islamic_life_companion.db"

    # Security
    # NOTE: In any non-development environment, SECRET_KEY MUST be provided
    # via the .env file (or your secret manager). The fallback below is only
    # used when the env var is missing AND no .env file is present. The
    # production guard at the bottom of this file will refuse to start the
    # app if the default value is still in use when ENV != "development".
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    # JWT aliases (mirror the names used in some helpers / docs)
    JWT_SECRET: Optional[str] = None
    JWT_ALGORITHM: Optional[str] = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # API
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Islamic Life Companion"
    ALADHAN_API_BASE_URL: str = "https://api.aladhan.com/v1"

    # Seed Data
    SEED_ADMIN_EMAIL: str = "admin@example.com"
    SEED_ADMIN_PASSWORD: str = "admin123"

    # CORS
    BACKEND_CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174"
    ]

settings = Settings()

# Production safety guard: refuse to start if the default SECRET_KEY is still in use.
_DEFAULT_SECRET = "your-secret-key-here-change-in-production"
if settings.SECRET_KEY == _DEFAULT_SECRET and settings.ENV.lower() != "development":
    raise RuntimeError(
        "SECRET_KEY is set to the default placeholder. "
        "Set SECRET_KEY in your .env file or environment before running in "
        f"ENV='{settings.ENV}'."
    )
