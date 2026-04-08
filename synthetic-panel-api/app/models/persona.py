"""
Persona model - AI characters with personalities and voices.
"""
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Persona(BaseModel):
    """
    AI persona/character with detailed personality and voice configuration.
    """

    __tablename__ = "personas"

    # Organization (multi-tenancy)
    organization_id = Column(
        PG_UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    # Basic Info
    name = Column(String(255), nullable=False)
    age = Column(Integer)
    gender = Column(String(50))
    country = Column(String(100))
    city = Column(String(100))
    education = Column(String(100))
    occupation = Column(String(255))

    # Personality
    personality = Column(Text)
    quirks = Column(ARRAY(Text), default=[])
    catchphrases = Column(ARRAY(Text), default=[])
    backstory = Column(Text)
    worldview = Column(Text)
    consumer_habits = Column(Text)

    # Appearance & Voice
    avatar_url = Column(Text)
    appearance_prompt = Column(Text)
    voice_id = Column(String(100))  # ElevenLabs voice ID
    voice_settings = Column(JSONB, default={})  # stability, similarity_boost, etc.

    # Knowledge & Framework
    knowledge_group_id = Column(
        PG_UUID(as_uuid=True),
        nullable=True,
        index=True,
    )  # FK to platform.knowledge_groups
    psychological_framework_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("synthetic_panel.frameworks.id", ondelete="SET NULL"),
        nullable=True,
    )
    archetype_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("synthetic_panel.archetypes.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Metadata
    language = Column(String(10), default="en")
    is_active = Column(Boolean, default=True)
    created_by = Column(PG_UUID(as_uuid=True))  # FK to auth_service.users

    # Relationships
    archetype = relationship("Archetype", back_populates="personas")
    framework = relationship("Framework", back_populates="personas")

    def __repr__(self) -> str:
        return f"<Persona(id={self.id}, name='{self.name}', org={self.organization_id})>"
