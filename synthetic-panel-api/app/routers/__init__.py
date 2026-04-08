"""
API Routers for Synthetic Panel.
"""
from app.routers.health import router as health_router
from app.routers.personas import router as personas_router
from app.routers.panels import router as panels_router
from app.routers.moderators import router as moderators_router
from app.routers.discussion_guides import router as discussion_guides_router
from app.routers.archetypes import router as archetypes_router
from app.routers.voice import router as voice_router
from app.routers.avatar import router as avatar_router
from app.routers.usage import router as usage_router
from app.routers.analysis import router as analysis_router
from app.routers.phrase_collections import router as phrase_collections_router

__all__ = [
    "health_router",
    "personas_router",
    "panels_router",
    "moderators_router",
    "discussion_guides_router",
    "archetypes_router",
    "voice_router",
    "avatar_router",
    "usage_router",
    "analysis_router",
    "phrase_collections_router",
]
