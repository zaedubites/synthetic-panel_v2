"""
Pydantic schemas for Voice endpoints.
"""
from typing import Any, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema, IDSchema, TimestampSchema
from app.schemas.persona import VoiceSettings


class VoiceInfo(BaseSchema):
    """Voice information from ElevenLabs."""

    voice_id: str
    name: str
    preview_url: Optional[str] = None
    category: Optional[str] = None  # premade, cloned, professional
    labels: dict[str, str] = Field(default_factory=dict)  # accent, age, gender, etc.


class VoiceLibraryResponse(BaseSchema):
    """Response from voice library listing."""

    voices: list[VoiceInfo]
    total: int


class VoicePreviewRequest(BaseSchema):
    """Request to preview a voice."""

    voice_id: str
    text: str = Field(..., min_length=1, max_length=500)
    settings: Optional[VoiceSettings] = None


class VoicePreviewResponse(BaseSchema):
    """Response from voice preview."""

    voice_id: str
    audio_url: str
    duration_seconds: float


class VoiceSpeakRequest(BaseSchema):
    """Request to generate speech."""

    voice_id: str
    text: str = Field(..., min_length=1, max_length=5000)
    settings: Optional[VoiceSettings] = None


class VoiceSpeakResponse(BaseSchema):
    """Response from speech generation."""

    voice_id: str
    audio_url: str
    duration_seconds: float
    characters_used: int


class VoicePresetBase(BaseSchema):
    """Base voice preset fields."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    provider: str = Field(default="elevenlabs", pattern="^(elevenlabs)$")
    voice_id: str = Field(..., min_length=1, max_length=100)
    voice_name: Optional[str] = Field(default=None, max_length=255)
    settings: Optional[VoiceSettings] = None


class VoicePresetCreate(VoicePresetBase):
    """Schema for creating a voice preset."""

    pass


class VoicePresetUpdate(BaseSchema):
    """Schema for updating a voice preset."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    voice_id: Optional[str] = Field(default=None, max_length=100)
    voice_name: Optional[str] = Field(default=None, max_length=255)
    settings: Optional[VoiceSettings] = None
    is_active: Optional[bool] = None


class VoicePresetResponse(VoicePresetBase, IDSchema, TimestampSchema):
    """Schema for voice preset response."""

    organization_id: UUID
    is_active: bool
    created_by: Optional[UUID] = None


class VoicePresetListResponse(BaseSchema):
    """Schema for paginated voice preset list."""

    items: list[VoicePresetResponse]
    total: int
    page: int
    page_size: int
