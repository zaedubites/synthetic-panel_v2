"""
Discussion Guide model - Structured question templates for panels.
"""
from sqlalchemy import Boolean, Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class DiscussionGuide(BaseModel):
    """
    Template of questions for panel discussions.
    Questions are stored as JSONB with probe hints.
    """

    __tablename__ = "discussion_guides"

    # Organization (multi-tenancy)
    organization_id = Column(
        PG_UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    # Basic Info
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Questions stored as JSONB array
    # [
    #     {
    #         "question": "What do you think about...?",
    #         "probe_hints": ["Follow up with...", "Ask about..."],
    #         "order": 1,
    #         "is_required": true,
    #         "category": "opening"
    #     },
    #     ...
    # ]
    questions = Column(JSONB, nullable=False, default=[])

    # Metadata
    language = Column(String(10), default="en")
    is_active = Column(Boolean, default=True)
    created_by = Column(PG_UUID(as_uuid=True))  # FK to auth_service.users

    # Relationships
    panels = relationship("Panel", back_populates="discussion_guide")

    def __repr__(self) -> str:
        return f"<DiscussionGuide(id={self.id}, name='{self.name}')>"
