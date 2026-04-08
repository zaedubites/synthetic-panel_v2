"""
Pydantic schemas for Phrase Collection (Dictionary) endpoints.
"""
from typing import Any, Optional
from uuid import UUID

from pydantic import ConfigDict, Field

from app.schemas.common import BaseSchema, IDSchema, TimestampSchema


# ── Phrase schemas ──


class PhraseBase(BaseSchema):
    """A single phrase entry within a collection."""

    phrase: str = Field(..., min_length=1, max_length=500)
    meaning: str = Field(..., min_length=1, max_length=1000)
    usage_context: Optional[str] = None
    example: Optional[str] = None
    category: Optional[str] = None
    formality: Optional[str] = None
    is_trending: bool = False
    popularity_score: Optional[float] = Field(default=None, ge=0, le=100)


class PhraseCreate(BaseSchema):
    """Schema for adding a phrase to a collection."""

    phrase: str = Field(..., min_length=1, max_length=500)
    meaning: str = Field(..., min_length=1, max_length=1000)
    usage_context: Optional[str] = None
    example: Optional[str] = None
    category: Optional[str] = None
    formality: str = "casual"
    is_trending: bool = False
    popularity_score: Optional[float] = Field(default=None, ge=0, le=100)


# ── Collection schemas ──


class PhraseCollectionCreate(BaseSchema):
    """Schema for creating a phrase collection."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    generation: Optional[str] = Field(default=None, max_length=50)
    language: str = Field(default="en", max_length=10)
    region: Optional[str] = None
    city: Optional[str] = None
    age_range: Optional[str] = None


class PhraseCollectionUpdate(BaseSchema):
    """Schema for updating a phrase collection."""

    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    generation: Optional[str] = Field(default=None, max_length=50)
    language: Optional[str] = Field(default=None, max_length=10)
    region: Optional[str] = None
    city: Optional[str] = None
    age_range: Optional[str] = None
    is_active: Optional[bool] = None


class PhraseCollectionResponse(IDSchema, TimestampSchema):
    """Schema for phrase collection response."""

    organization_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    generation: Optional[str] = None
    language: str = "en"
    region: Optional[str] = None
    city: Optional[str] = None
    age_range: Optional[str] = None
    phrases: list[dict] = Field(default_factory=list)
    is_active: bool = True


class PhraseCollectionListResponse(BaseSchema):
    """Schema for paginated phrase collection list."""

    items: list[PhraseCollectionResponse]
    total: int
    page: int
    page_size: int


class PhraseGenerateRequest(BaseSchema):
    """Schema for requesting AI phrase generation."""

    count: int = Field(default=20, ge=1, le=50)
