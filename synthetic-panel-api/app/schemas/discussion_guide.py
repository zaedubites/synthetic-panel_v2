"""
Pydantic schemas for Discussion Guide endpoints.
"""
from typing import Any, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema, IDSchema, TimestampSchema


class DiscussionQuestion(BaseSchema):
    """Individual question in a discussion guide."""

    question: str = Field(..., min_length=1)
    probe_hints: list[str] = Field(default_factory=list)
    order: int = Field(default=0, ge=0)
    is_required: bool = True
    category: Optional[str] = None  # opening, main, closing, etc.


class DiscussionGuideBase(BaseSchema):
    """Base discussion guide fields."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    questions: list[DiscussionQuestion] = Field(default_factory=list)
    language: str = Field(default="en", max_length=10)


class DiscussionGuideCreate(DiscussionGuideBase):
    """Schema for creating a discussion guide."""

    pass


class DiscussionGuideUpdate(BaseSchema):
    """Schema for updating a discussion guide."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    questions: Optional[list[DiscussionQuestion]] = None
    language: Optional[str] = Field(default=None, max_length=10)
    is_active: Optional[bool] = None


class DiscussionGuideResponse(DiscussionGuideBase, IDSchema, TimestampSchema):
    """Schema for discussion guide response."""

    organization_id: UUID
    is_active: bool
    created_by: Optional[UUID] = None


class DiscussionGuideListResponse(BaseSchema):
    """Schema for paginated discussion guide list."""

    items: list[DiscussionGuideResponse]
    total: int
    page: int
    page_size: int
