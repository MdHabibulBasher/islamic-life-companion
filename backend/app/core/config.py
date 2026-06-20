from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Environment
    ENV: str = "development"
    
    # Database
    DATABASE_URL: str = "sqlite:///./islamic_life_companion.db"
    
    # Security
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
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
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173"
    ]
    
    class Config:
        env_file = ".env"

settings = Settings()
