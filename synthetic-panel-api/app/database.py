"""
Database configuration and session management.
Uses async SQLAlchemy with asyncpg driver.
Compatible with Supavisor transaction mode (port 6543).
"""
import logging
from typing import AsyncGenerator
from contextlib import asynccontextmanager
from uuid import uuid4

from asyncpg import Connection
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from sqlalchemy import text

from app.config import settings

logger = logging.getLogger(__name__)


# Custom asyncpg connection class that uses UUID-based prepared statement names
# Prevents collisions when using Supavisor transaction pooling
class SupabaseConnection(Connection):
    """Custom connection class for Supabase that uses UUID-based statement names."""
    def _get_unique_id(self, prefix: str) -> str:
        return f"__asyncpg_{prefix}_{uuid4()}__"


# Supabase/Supavisor optimized connection args
CONNECT_ARGS = {
    "timeout": 30,
    "command_timeout": 60,
    "statement_cache_size": 0,
    "prepared_statement_cache_size": 0,
    "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
    "server_settings": {
        "search_path": settings.DATABASE_SCHEMA,
    },
}

# Add custom connection class for transaction mode (port 6543)
if ":6543/" in settings.async_database_url or settings.async_database_url.endswith(":6543"):
    CONNECT_ARGS["connection_class"] = SupabaseConnection
    logger.info("Using SupabaseConnection for transaction mode (port 6543)")

# Create async engine with NullPool for serverless/Supavisor compatibility
engine = create_async_engine(
    settings.async_database_url,
    echo=settings.DEBUG,
    poolclass=NullPool,
    connect_args=CONNECT_ARGS,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency that provides a database session.
    Handles commit/rollback automatically.
    """
    async with async_session_maker() as session:
        try:
            # Set search path to include all schemas we need to access
            await session.execute(
                text(f"SET search_path TO {settings.DATABASE_SCHEMA}, {settings.PLATFORM_SCHEMA}, {settings.AUTH_SCHEMA}, public")
            )
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """
    Context manager version of get_db for use outside of FastAPI dependencies.
    """
    async with async_session_maker() as session:
        try:
            await session.execute(
                text(f"SET search_path TO {settings.DATABASE_SCHEMA}, {settings.PLATFORM_SCHEMA}, {settings.AUTH_SCHEMA}, public")
            )
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            await session.close()


async def init_db():
    """
    Initialize database schema.
    Called on application startup.
    """
    async with engine.begin() as conn:
        # Create schema if it doesn't exist
        await conn.execute(
            text(f"CREATE SCHEMA IF NOT EXISTS {settings.DATABASE_SCHEMA}")
        )
        logger.info(f"Ensured schema '{settings.DATABASE_SCHEMA}' exists")


async def check_db_connection() -> bool:
    """
    Check if database connection is healthy.
    """
    try:
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database connection check failed: {e}")
        return False
