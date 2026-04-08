"""
Health check endpoints.
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import check_db_connection, get_db
from app.schemas import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Check API health status.
    """
    db_healthy = await check_db_connection()

    return HealthResponse(
        status="healthy" if db_healthy else "degraded",
        version=settings.APP_VERSION,
        database=db_healthy,
        timestamp=datetime.utcnow(),
    )


@router.get("/")
async def root():
    """
    Root endpoint.
    """
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }
