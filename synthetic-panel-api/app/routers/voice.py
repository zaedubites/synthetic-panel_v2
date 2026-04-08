"""
Voice API Router

Endpoints for text-to-speech generation using ElevenLabs,
plus voice library CRUD and ElevenLabs shared library browsing.
"""

import logging
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.auth import get_current_user, TokenPayload
from app.services.voice_service import VoiceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["voice"])


class GenerateSpeechRequest(BaseModel):
    """Request to generate speech from text."""
    text: str
    voice_id: str
    model_id: Optional[str] = None
    stability: float = 0.5
    similarity_boost: float = 0.75


class VoiceRecommendation(BaseModel):
    """Voice recommendation for a persona."""
    gender: Optional[str] = None
    age_range: Optional[str] = None
    language: str = "en"


class LibraryVoiceCreate(BaseModel):
    """Request to add a voice to the library."""
    elevenlabs_voice_id: str
    name: str
    description: Optional[str] = ""
    age_range: str = "adult"
    gender: str = "neutral"
    language: str = "en"
    preview_url: Optional[str] = None
    notes: Optional[str] = ""
    characteristics: list[str] = Field(default_factory=list)
    verified_languages: list[str] = Field(default_factory=list)
    custom_settings: dict[str, Any] = Field(default_factory=dict)


class LibraryVoiceUpdate(BaseModel):
    """Request to update a library voice."""
    name: Optional[str] = None
    age_range: Optional[str] = None
    gender: Optional[str] = None
    language: Optional[str] = None
    custom_settings: Optional[dict[str, Any]] = None
    is_approved: Optional[bool] = None
    notes: Optional[str] = None
    characteristics: Optional[list[str]] = None


@router.post("/generate")
async def generate_speech(
    request: GenerateSpeechRequest,
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Generate speech audio from text.

    Returns MP3 audio bytes.
    """
    try:
        voice_service = VoiceService()
        audio_bytes = await voice_service.generate_speech(
            text=request.text,
            voice_id=request.voice_id,
            model_id=request.model_id,
            stability=request.stability,
            similarity_boost=request.similarity_boost
        )

        return StreamingResponse(
            iter([audio_bytes]),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=speech.mp3"}
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to generate speech")


@router.post("/generate/stream")
async def generate_speech_stream(
    request: GenerateSpeechRequest,
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Stream speech audio generation for real-time playback.
    """
    try:
        voice_service = VoiceService()

        async def audio_stream():
            async for chunk in voice_service.generate_speech_stream(
                text=request.text,
                voice_id=request.voice_id,
                model_id=request.model_id
            ):
                yield chunk

        return StreamingResponse(
            audio_stream(),
            media_type="audio/mpeg"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to stream speech")


@router.get("/voices")
async def list_voices(
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Get list of available ElevenLabs voices.
    """
    try:
        voice_service = VoiceService()
        voices = await voice_service.list_voices()
        return {"voices": voices}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch voices")


@router.get("/voices/{voice_id}")
async def get_voice(
    voice_id: str,
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Get details for a specific voice.
    """
    try:
        voice_service = VoiceService()
        voice = await voice_service.get_voice(voice_id)
        return voice
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch voice")


@router.get("/recommended")
async def get_recommended_voices(
    language: str = "en",
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Get recommended voices for focus group personas.
    """
    voice_service = VoiceService()
    voices = voice_service.get_recommended_voices(language)
    return {"voices": voices}


@router.post("/recommend")
async def recommend_voice(
    request: VoiceRecommendation,
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Get a recommended voice ID based on persona characteristics.
    """
    voice_service = VoiceService()
    voice_id = voice_service.select_voice_for_persona(
        gender=request.gender,
        age_range=request.age_range,
        language=request.language
    )

    if not voice_id:
        raise HTTPException(
            status_code=404,
            detail="No matching voice found"
        )

    return {"voice_id": voice_id}


# ============================================
# Browse ElevenLabs Shared Library
# ============================================

@router.get("/browse")
async def browse_shared_voices(
    query: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=100, ge=1, le=500),
    current_user: TokenPayload = Depends(get_current_user),
):
    """
    Browse the ElevenLabs shared voice library.

    Proxies to the ElevenLabs /v1/shared-voices endpoint.
    """
    try:
        voice_service = VoiceService()
        result = await voice_service.browse_shared_voices(
            query=query,
            page=page,
            page_size=pageSize,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to browse shared voices")
        raise HTTPException(status_code=500, detail="Failed to browse voices")


# ============================================
# Voice Library CRUD (stored in our DB)
# ============================================

@router.post("/library")
async def add_to_library(
    request: LibraryVoiceCreate,
    current_user: TokenPayload = Depends(get_current_user),
):
    """
    Add a voice from ElevenLabs shared library to our voice library.
    """
    try:
        voice_service = VoiceService()
        voice = await voice_service.add_to_library(
            org_id=current_user.organization_id,
            data=request.model_dump(),
        )
        return {"success": True, "voice": voice}
    except Exception as e:
        logger.exception("Failed to add voice to library")
        raise HTTPException(status_code=500, detail="Failed to add voice")


@router.patch("/library/{voice_id}")
async def update_library_voice(
    voice_id: str,
    request: LibraryVoiceUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    """
    Update a voice in our library.
    """
    try:
        voice_service = VoiceService()
        voice = await voice_service.update_library_voice(
            org_id=current_user.organization_id,
            voice_id=voice_id,
            data=request.model_dump(exclude_none=True),
        )
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found")
        return {"success": True, "voice": voice}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update library voice")
        raise HTTPException(status_code=500, detail="Failed to update voice")


@router.delete("/library/{voice_id}")
async def delete_library_voice(
    voice_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    """
    Remove a voice from our library.
    """
    try:
        voice_service = VoiceService()
        ok = await voice_service.delete_library_voice(
            org_id=current_user.organization_id,
            voice_id=voice_id,
        )
        if not ok:
            raise HTTPException(status_code=404, detail="Voice not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete library voice")
        raise HTTPException(status_code=500, detail="Failed to delete voice")
