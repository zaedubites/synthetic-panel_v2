"""
Phrase Collection model - Slang and colloquial expressions by generation.
"""
from sqlalchemy import Boolean, Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

from app.models.base import BaseModel


class PhraseCollection(BaseModel):
    """
    Collection of slang/colloquial phrases for different generations.
    Used to make persona responses more authentic.
    """

    __tablename__ = "phrase_collections"

    # Organization (NULL = global collection)
    organization_id = Column(
        PG_UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    # Basic Info
    name = Column(String(255), nullable=False)
    description = Column(Text)
    generation = Column(String(50))  # gen_alpha, gen_z, millennial, etc.
    language = Column(String(10), default="en")
    region = Column(String(100))
    city = Column(String(100))
    age_range = Column(String(20))

    # Phrases stored as JSONB
    # [
    #     {
    #         "phrase": "no cap",
    #         "meaning": "for real, not lying",
    #         "usage_context": "emphasis",
    #         "example": "This is the best pizza, no cap."
    #     },
    #     ...
    # ]
    phrases = Column(JSONB, nullable=False, default=[])

    # Status
    is_active = Column(Boolean, default=True)

    def __repr__(self) -> str:
        return f"<PhraseCollection(id={self.id}, name='{self.name}', gen='{self.generation}')>"
