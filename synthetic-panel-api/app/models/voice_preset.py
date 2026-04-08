"""
Voice Preset model - Saved voice configurations.
"""
from sqlalchemy import Boolean, Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

from app.models.base import BaseModel


class VoicePreset(BaseModel):
    """
    Saved voice configuration for reuse across personas/moderators.
    """

    __tablename__ = "voice_presets"

    # Organization (multi-tenancy)
    organization_id = Column(
        PG_UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    # Basic Info
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Voice Provider
    provider = Column(String(50), default="elevenlabs")
    voice_id = Column(String(100), nullable=False)  # Provider's voice ID
    voice_name = Column(String(255))  # Human-readable voice name

    # Voice Settings
    # {
    #     "stability": 0.5,
    #     "similarity_boost": 0.75,
    #     "style": 0.0,
    #     "use_speaker_boost": true
    # }
    settings = Column(JSONB, default={})

    # Status
    is_active = Column(Boolean, default=True)
    created_by = Column(PG_UUID(as_uuid=True))  # FK to auth_service.users

    def __repr__(self) -> str:
        return f"<VoicePreset(id={self.id}, name='{self.name}', voice='{self.voice_id}')>"
