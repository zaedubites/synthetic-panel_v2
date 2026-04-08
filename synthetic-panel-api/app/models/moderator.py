"""
Moderator model - Panel facilitators (AI or self).
"""
from sqlalchemy import Boolean, Column, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Moderator(BaseModel):
    """
    Panel moderator configuration.
    Can be used for AI-moderated panels.
    """

    __tablename__ = "moderators"

    # Basic Info
    name = Column(String(255), nullable=False)
    type = Column(String(50), default="professional")  # professional, empath, challenger, neutral, energizer, expert
    gender = Column(String(20), nullable=True)
    bio = Column(Text, nullable=True)

    # Personality traits: {warmth: int, pace: int, formality: int, humor: int}
    personality = Column(JSONB, default={})

    # Voice & Avatar
    voice_id = Column(String(100), nullable=True)  # ElevenLabs voice ID
    voice_name = Column(String(255), nullable=True)
    voice_settings = Column(JSONB, nullable=True)
    avatar_url = Column(Text, nullable=True)

    # Phrases: {opening: str, transitions: [str], closing: str}
    phrases = Column(JSONB, nullable=True)

    # Stats
    session_count = Column(Integer, default=0)

    # Status
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    # Organization (multi-tenancy)
    organization_id = Column(
        PG_UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    created_by = Column(PG_UUID(as_uuid=True), nullable=True)

    # Relationships
    panels = relationship("Panel", back_populates="moderator")

    def __repr__(self) -> str:
        return f"<Moderator(id={self.id}, name='{self.name}')>"
