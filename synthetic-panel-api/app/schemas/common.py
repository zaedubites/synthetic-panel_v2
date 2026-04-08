"""
Common Pydantic schemas shared across the API.
"""
from datetime import datetime
from typing import Any, Generic, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BaseSchema(BaseModel):
    """Base schema with common configuration."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class TimestampSchema(BaseSchema):
    """Schema with timestamp fields."""

    created_at: datetime
    updated_at: datetime


class IDSchema(BaseSchema):
    """Schema with ID field."""

    id: UUID


T = TypeVar("T")


class PaginatedResponse(BaseSchema, Generic[T]):
    """Paginated response wrapper."""

    items: list[T]
    total: int
    page: int = 1
    page_size: int = 20
    pages: int = 1


class MessageResponse(BaseSchema):
    """Simple message response."""

    message: str
    success: bool = True


class ErrorResponse(BaseSchema):
    """Error response."""

    detail: str
    error_code: Optional[str] = None


class HealthResponse(BaseSchema):
    """Health check response."""

    status: str
    version: str
    database: bool
    timestamp: datetime = Field(default_factory=datetime.utcnow)
