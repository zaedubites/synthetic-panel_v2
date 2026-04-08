"""
Pydantic schemas for Archetype endpoints.
"""
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import ConfigDict, Field, field_validator

from app.schemas.common import BaseSchema, IDSchema, TimestampSchema


class ArchetypeBase(BaseSchema):
    """Base archetype fields."""

    model_config = ConfigDict(extra="ignore")

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    driver: Optional[str] = None
    core_value: Optional[str] = None
    key_behaviors: list[str] = Field(default_factory=list)
    communication_patterns: Optional[list[str]] = Field(default_factory=list)

    @field_validator("communication_patterns", mode="before")
    @classmethod
    def coerce_communication_patterns(cls, v):
        """Accept dict or list — convert dict to list of 'key: value' strings for DB storage."""
        if v is None:
            return []
        if isinstance(v, dict):
            return [f"{k}: {val}" for k, val in v.items() if val]
        if isinstance(v, list):
            return v
        return []
    age_min: Optional[int] = Field(default=None, ge=0, le=120)
    age_max: Optional[int] = Field(default=None, ge=0, le=120)
    generation: Optional[str] = Field(default=None, max_length=50)
    location_type: Optional[str] = None
    demographic_tags: list[str] = Field(default_factory=list)
    example_quotes: list[str] = Field(default_factory=list)
    example_interests: list[str] = Field(default_factory=list)


class ArchetypeCreate(ArchetypeBase):
    """Schema for creating an archetype."""

    source_knowledge_group_id: Optional[UUID] = None


class ArchetypeUpdate(BaseSchema):
    """Schema for updating an archetype."""

    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    driver: Optional[str] = None
    core_value: Optional[str] = None
    key_behaviors: Optional[list[str]] = None
    communication_patterns: Optional[list[str]] = None

    @field_validator("communication_patterns", mode="before")
    @classmethod
    def coerce_communication_patterns(cls, v):
        if v is None:
            return None
        if isinstance(v, dict):
            return [f"{k}: {val}" for k, val in v.items() if val]
        return v
    age_min: Optional[int] = Field(default=None, ge=0, le=120)
    age_max: Optional[int] = Field(default=None, ge=0, le=120)
    generation: Optional[str] = Field(default=None, max_length=50)
    location_type: Optional[str] = Field(default=None, pattern="^(urban|suburban|rural)$")
    demographic_tags: Optional[list[str]] = None
    example_quotes: Optional[list[str]] = None
    example_interests: Optional[list[str]] = None
    is_active: Optional[bool] = None


class ArchetypeResponse(ArchetypeBase, IDSchema, TimestampSchema):
    """Schema for archetype response."""

    organization_id: Optional[UUID] = None  # NULL = global
    source_knowledge_group_id: Optional[UUID] = None
    is_active: bool


class ArchetypeListResponse(BaseSchema):
    """Schema for paginated archetype list."""

    items: list[ArchetypeResponse]
    total: int
    page: int
    page_size: int


class ArchetypeExtractRequest(BaseSchema):
    """Request to extract archetypes from knowledge sources."""

    knowledge_group_id: Optional[UUID] = None
    source_ids: Optional[list[UUID]] = None
    target_generations: Optional[list[str]] = None
    target_age_range: Optional[dict] = None  # {"min": 10, "max": 25}
    extraction_focus: Optional[str] = None
    max_archetypes: int = Field(default=5, ge=1, le=10)


class ExtractedArchetype(BaseSchema):
    """An archetype extracted by AI, with confidence and source info."""

    model_config = ConfigDict(extra="ignore")

    name: str
    description: Optional[str] = None
    driver: Optional[str] = None
    core_value: Optional[str] = None
    core_value_detail: Optional[str] = None
    key_behaviors: list[str] = Field(default_factory=list)
    communication_patterns: Optional[list[str]] = Field(default_factory=list)

    @field_validator("communication_patterns", mode="before")
    @classmethod
    def coerce_communication_patterns(cls, v):
        if v is None:
            return []
        if isinstance(v, dict):
            return [f"{k}: {val}" for k, val in v.items() if val]
        return v if isinstance(v, list) else []
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    generation: Optional[str] = None
    demographic_tags: list[str] = Field(default_factory=list)
    example_quotes: list[str] = Field(default_factory=list)
    example_interests: list[str] = Field(default_factory=list)
    confidence: Literal["high", "medium", "low"] = "medium"
    source_references: list[str] = Field(default_factory=list)


class ArchetypeExtractResponse(BaseSchema):
    """Response from archetype extraction."""

    extracted_archetypes: list[ExtractedArchetype]
    extraction_notes: str
    sources_analyzed: int
    total_content_analyzed: str


class ArchetypeGenerateResponse(BaseSchema):
    """Response from archetype profile generation."""

    success: bool
    archetype: ArchetypeResponse


class TaskDispatchResponse(BaseSchema):
    """Response when a task is dispatched to the background worker."""

    task_id: str
    status: str


class TaskStatusResponse(BaseSchema):
    """Response for checking background task status."""

    task_id: str
    status: str
    result: Optional[dict] = None
    error: Optional[str] = None
