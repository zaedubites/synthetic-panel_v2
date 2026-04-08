"""
Pydantic schemas for Moderator endpoints.
"""
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import ConfigDict, Field

from app.schemas.common import BaseSchema, IDSchema, TimestampSchema


class ModeratorCreate(BaseSchema):
    """Schema for creating a moderator."""

    model_config = ConfigDict(extra="ignore")

    name: str = Field(..., min_length=1, max_length=255)
    type: Optional[str] = Field(default="professional")
    gender: Optional[str] = None
    bio: Optional[str] = None
    personality: Optional[dict] = None
    voice_id: Optional[str] = None
    voice_name: Optional[str] = None
    voice_settings: Optional[dict] = None
    avatar_url: Optional[str] = None
    phrases: Optional[dict] = None


class ModeratorUpdate(BaseSchema):
    """Schema for updating a moderator."""

    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    type: Optional[str] = None
    gender: Optional[str] = None
    bio: Optional[str] = None
    personality: Optional[dict] = None
    voice_id: Optional[str] = None
    voice_name: Optional[str] = None
    voice_settings: Optional[dict] = None
    avatar_url: Optional[str] = None
    phrases: Optional[dict] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class ModeratorResponse(IDSchema, TimestampSchema):
    """Schema for moderator response."""

    model_config = ConfigDict(extra="ignore")

    name: str
    type: Optional[str] = None
    gender: Optional[str] = None
    bio: Optional[str] = None
    personality: Optional[dict] = None
    voice_id: Optional[str] = None
    voice_name: Optional[str] = None
    voice_settings: Optional[dict] = None
    avatar_url: Optional[str] = None
    phrases: Optional[dict] = None
    session_count: int = 0
    is_default: bool = False
    is_active: bool = True
    organization_id: Optional[UUID] = None
    created_by: Optional[UUID] = None


class ModeratorListResponse(BaseSchema):
    """Schema for paginated moderator list."""

    items: list[ModeratorResponse]
    total: int
    page: int
    page_size: int


class GenerateAvatarRequest(BaseSchema):
    """Request to generate moderator avatar."""

    model_config = ConfigDict(extra="ignore")

    custom_prompt: Optional[str] = None
