"""
Framework model - Psychological frameworks for personas.
"""
from sqlalchemy import Boolean, Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Framework(BaseModel):
    """
    Psychological framework that defines personality dimensions.
    Examples: Big Five, MBTI, custom frameworks, etc.
    """

    __tablename__ = "frameworks"

    # Organization (NULL = global framework)
    organization_id = Column(
        PG_UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    # Basic Info
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Framework dimensions stored as JSONB
    # Example for Big Five:
    # {
    #     "openness": {"min": 0, "max": 100, "description": "..."},
    #     "conscientiousness": {"min": 0, "max": 100, "description": "..."},
    #     ...
    # }
    dimensions = Column(JSONB, default={})

    # Status
    is_active = Column(Boolean, default=True)

    # Relationships
    personas = relationship("Persona", back_populates="framework")

    def __repr__(self) -> str:
        return f"<Framework(id={self.id}, name='{self.name}')>"
