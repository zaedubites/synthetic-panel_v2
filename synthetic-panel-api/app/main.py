"""
Synthetic Panel API - FastAPI Application

AI-powered focus group simulation platform.
"""
import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.routers import (
    archetypes_router,
    discussion_guides_router,
    health_router,
    moderators_router,
    panels_router,
    personas_router,
    voice_router,
    avatar_router,
    usage_router,
    analysis_router,
    phrase_collections_router,
)
from app.routers.websocket import router as websocket_router

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize Sentry if configured
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        environment=settings.ENVIRONMENT,
    )
    logger.info("Sentry initialized")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")

    # Initialize database schema
    await init_db()
    logger.info("Database initialized")

    yield

    # Shutdown
    logger.info("Shutting down...")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered focus group simulation platform",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions."""
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# Include routers
app.include_router(health_router, prefix="/api")
app.include_router(personas_router, prefix="/api")
app.include_router(panels_router, prefix="/api")
app.include_router(moderators_router, prefix="/api")
app.include_router(discussion_guides_router, prefix="/api")
app.include_router(archetypes_router, prefix="/api")
app.include_router(voice_router, prefix="/api")
app.include_router(avatar_router, prefix="/api")
app.include_router(usage_router, prefix="/api")
app.include_router(analysis_router, prefix="/api")
app.include_router(phrase_collections_router, prefix="/api")

# WebSocket router (no /api prefix)
app.include_router(websocket_router, tags=["websocket"])

# Log registered routes
if settings.DEBUG:
    for route in app.routes:
        if hasattr(route, "methods"):
            logger.debug(f"Route: {route.methods} {route.path}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8003,
        reload=settings.DEBUG,
    )
