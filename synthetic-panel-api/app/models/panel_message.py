"""
Panel Message model - Individual messages in panel transcript.
"""
import enum

from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class MessageRole(str, enum.Enum):
    USER = "user"
    MODERATOR = "moderator"
    PERSONA = "persona"
    SYSTEM = "system"


class PanelMessage(BaseModel):
    """
    Individual message in a panel conversation.
    Stores the full transcript with metadata.
    """

    __tablename__ = "panel_messages"

    # Parent panel
    panel_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("synthetic_panel.panels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Message Info
    role = Column(String(20), nullable=False)  # 'moderator', 'persona', 'user', 'system'
    persona_id = Column(
        PG_UUID(as_uuid=True),
        nullable=True,
    )  # FK to personas (if role = 'persona')
    content = Column(Text, nullable=False)

    # Audio
    audio_url = Column(Text)  # Generated TTS audio URL

    # Metadata
    # {
    #     "emotion": "neutral",
    #     "confidence": 0.85,
    #     "response_time_ms": 1234,
    #     "tokens_used": {"input": 100, "output": 50},
    #     "model": "gpt-4o"
    # }
    message_metadata = Column(JSONB, default={})

    # Ordering
    sequence_number = Column(Integer, nullable=False)

    # Relationships
    panel = relationship("Panel", back_populates="messages")

    def __repr__(self) -> str:
        return f"<PanelMessage(id={self.id}, panel={self.panel_id}, role='{self.role}', seq={self.sequence_number})>"
