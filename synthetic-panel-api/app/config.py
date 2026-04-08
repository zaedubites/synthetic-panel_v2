"""
Configuration settings for Synthetic Panel API.
All settings are loaded from environment variables.
"""
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App Info
    APP_NAME: str = "Synthetic Panel API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str
    DATABASE_SCHEMA: str = "synthetic_panel"

    # Cross-schema references
    AUTH_SCHEMA: str = "auth_service"
    PLATFORM_SCHEMA: str = "platform"

    # JWT Authentication (RS256)
    JWT_ALGORITHM: str = "RS256"
    JWT_PUBLIC_KEY: str

    # External Services
    AUTH_SERVICE_URL: str = "http://localhost:8001"
    PLATFORM_API_URL: str = "http://localhost:8000"

    # Azure OpenAI
    AZURE_OPENAI_API_KEY: Optional[str] = None
    AZURE_OPENAI_ENDPOINT: Optional[str] = None
    AZURE_OPENAI_API_VERSION: str = "2024-08-01-preview"
    AZURE_OPENAI_DEPLOYMENT: str = "gpt-4o"
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT: str = "text-embedding-3-large"

    # ElevenLabs (Voice)
    ELEVENLABS_API_KEY: Optional[str] = None

    # Replicate (Avatar Generation)
    REPLICATE_API_KEY: Optional[str] = None

    # Supabase Storage
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_KEY: Optional[str] = None

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30

    # Redis
    REDIS_URL: Optional[str] = None
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None
    REDIS_DB: int = 0

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3004",
        "http://localhost:3001",
        "http://localhost:3002",
    ]
    CORS_ALLOW_CREDENTIALS: bool = True

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    # Sentry (optional)
    SENTRY_DSN: Optional[str] = None
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1

    @property
    def redis_connection_url(self) -> str:
        """Build Redis URL from components if not provided directly."""
        if self.REDIS_URL:
            return self.REDIS_URL
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    @property
    def async_database_url(self) -> str:
        """Ensure database URL uses asyncpg driver."""
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
