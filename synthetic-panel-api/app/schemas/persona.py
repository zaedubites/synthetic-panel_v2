"""
Pydantic schemas for Persona endpoints.
"""
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema, IDSchema, TimestampSchema


class VoiceSettings(BaseSchema):
    """Voice configuration settings."""

    stability: float = Field(default=0.5, ge=0, le=1)
    similarity_boost: float = Field(default=0.75, ge=0, le=1)
    style: float = Field(default=0.0, ge=0, le=1)
    use_speaker_boost: bool = True


class PersonaBase(BaseSchema):
    """Base persona fields."""

    name: str = Field(..., min_length=1, max_length=255)
    age: Optional[int] = Field(default=None, ge=1, le=120)
    gender: Optional[str] = Field(default=None, max_length=50)
    country: Optional[str] = Field(default=None, max_length=100)
    city: Optional[str] = Field(default=None, max_length=100)
    education: Optional[str] = Field(default=None, max_length=100)
    occupation: Optional[str] = Field(default=None, max_length=255)
    personality: Optional[str] = None
    quirks: list[str] = Field(default_factory=list)
    catchphrases: list[str] = Field(default_factory=list)
    backstory: Optional[str] = None
    worldview: Optional[str] = None
    consumer_habits: Optional[str] = None
    avatar_url: Optional[str] = None
    appearance_prompt: Optional[str] = None
    voice_id: Optional[str] = Field(default=None, max_length=100)
    voice_settings: Optional[VoiceSettings] = None
    knowledge_group_id: Optional[UUID] = None
    psychological_framework_id: Optional[UUID] = None
    archetype_id: Optional[UUID] = None
    language: str = Field(default="en", max_length=10)


class PersonaCreate(PersonaBase):
    """Schema for creating a persona."""

    pass


class PersonaUpdate(BaseSchema):
    """Schema for updating a persona."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    age: Optional[int] = Field(default=None, ge=1, le=120)
    gender: Optional[str] = Field(default=None, max_length=50)
    country: Optional[str] = Field(default=None, max_length=100)
    city: Optional[str] = Field(default=None, max_length=100)
    education: Optional[str] = Field(default=None, max_length=100)
    occupation: Optional[str] = Field(default=None, max_length=255)
    personality: Optional[str] = None
    quirks: Optional[list[str]] = None
    catchphrases: Optional[list[str]] = None
    backstory: Optional[str] = None
    worldview: Optional[str] = None
    consumer_habits: Optional[str] = None
    avatar_url: Optional[str] = None
    appearance_prompt: Optional[str] = None
    voice_id: Optional[str] = Field(default=None, max_length=100)
    voice_settings: Optional[VoiceSettings] = None
    knowledge_group_id: Optional[UUID] = None
    psychological_framework_id: Optional[UUID] = None
    archetype_id: Optional[UUID] = None
    language: Optional[str] = Field(default=None, max_length=10)
    is_active: Optional[bool] = None


class PersonaResponse(PersonaBase, IDSchema, TimestampSchema):
    """Schema for persona response."""

    organization_id: UUID
    is_active: bool
    created_by: Optional[UUID] = None


class PersonaListResponse(BaseSchema):
    """Schema for paginated persona list."""

    items: list[PersonaResponse]
    total: int
    page: int
    page_size: int


class PersonaGenerateProfileRequest(BaseSchema):
    """Request to generate persona profile from basic info."""

    use_knowledge: bool = True  # Use knowledge group for context


class PersonaGenerateBackstoryRequest(BaseSchema):
    """Request to generate persona backstory."""

    length: str = Field(default="medium", pattern="^(short|medium|long)$")


class PersonaGenerateWorldviewRequest(BaseSchema):
    """Request to generate persona worldview."""

    topics: list[str] = Field(default_factory=list)  # Optional specific topics


class PersonaGenerateAvatarRequest(BaseSchema):
    """Request to generate persona avatar."""

    style: str = Field(default="realistic", pattern="^(realistic)$")  # Only realistic for now
    regenerate: bool = False


class PersonaChatRequest(BaseSchema):
    """Request for 1:1 chat with persona."""

    message: str = Field(..., min_length=1)
    include_history: bool = True


class PersonaChatResponse(BaseSchema):
    """Response from persona chat."""

    message: str
    persona_id: UUID
    audio_url: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class PersonaPreview(BaseSchema):
    """A single persona preview from the builder."""

    name: str = Field(..., min_length=1, max_length=255)
    age: Optional[int] = Field(default=None, ge=1, le=120)
    gender: Optional[str] = Field(default=None, max_length=50)
    country: Optional[str] = Field(default=None, max_length=100)
    city: Optional[str] = Field(default=None, max_length=100)
    education: Optional[str] = Field(default=None, max_length=100)
    occupation: Optional[str] = Field(default=None, max_length=255)
    archetype_id: Optional[UUID] = None
    archetype_name: Optional[str] = None
    archetype_driver: Optional[str] = None
    archetype_core_value: Optional[str] = None
    language: str = Field(default="en", max_length=10)


class PreviewPersonasRequest(BaseSchema):
    """Request to generate persona previews via AI."""

    archetypes: list[dict] = Field(..., min_length=1, description="List of archetype dicts with id, name, description, driver, core_value, age_min, age_max")
    demographics: dict = Field(..., description="Demographics dict with age_range, gender_ratio, countries, location_types, youth_family, adult_family")
    variations_per_archetype: int = Field(default=3, ge=1, le=10)
    knowledge_group_ids: Optional[list[str]] = None
    knowledge_source_ids: Optional[list[str]] = None


class BatchGenerateRequest(BaseSchema):
    """Request to batch-generate full personas from previews."""

    previews: list[PersonaPreview] = Field(..., min_length=1)
    generate_backstories: bool = True
    generate_avatars: bool = True
    knowledge_group_ids: Optional[list[UUID]] = None


class BatchGenerateResponse(BaseSchema):
    """Response from batch persona generation dispatch."""

    task_ids: list[str]
    persona_ids: list[str]
    status: str
