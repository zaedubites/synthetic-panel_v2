"""
Archetype model - Psychological profiles and persona templates.
"""
from sqlalchemy import Boolean, Column, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Archetype(BaseModel):
    """
    Psychological archetype that can be assigned to personas.
    Examples: Gen Alpha types, behavioral segments, etc.
    """

    __tablename__ = "archetypes"

    # Organization (NULL = global archetype)
    organization_id = Column(
        PG_UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    # Basic Info
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Profile
    driver = Column(Text)  # What motivates this archetype
    core_value = Column(Text)  # Central value/belief
    key_behaviors = Column(ARRAY(Text), default=[])
    communication_patterns = Column(ARRAY(Text), default=[])

    # Demographics
    age_min = Column(Integer)
    age_max = Column(Integer)
    generation = Column(String(50))  # gen_alpha, gen_z, millennial, etc.
    location_type = Column(String(50))  # urban, suburban, rural
    demographic_tags = Column(ARRAY(Text), default=[])

    # Examples
    example_quotes = Column(ARRAY(Text), default=[])
    example_interests = Column(ARRAY(Text), default=[])

    # Source
    source_knowledge_group_id = Column(
        PG_UUID(as_uuid=True),
        nullable=True,
    )  # Extracted from this knowledge group

    # Status
    is_active = Column(Boolean, default=True)

    # Relationships
    personas = relationship("Persona", back_populates="archetype")

    def __repr__(self) -> str:
        return f"<Archetype(id={self.id}, name='{self.name}')>"
