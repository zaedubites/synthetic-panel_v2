"""
Panel model - Focus group session configuration and state.
"""
import enum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class PanelStatus(str, enum.Enum):
    DRAFT = "draft"
    READY = "ready"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Panel(BaseModel):
    """
    Focus group panel session.
    Contains configuration, participants, and session state.
    """

    __tablename__ = "panels"

    # Organization (multi-tenancy)
    organization_id = Column(
        PG_UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    # Basic Info
    name = Column(String(255), nullable=False)
    description = Column(Text)
    research_goal = Column(Text)

    # Configuration
    moderation_mode = Column(String(20), default="ai")  # 'ai' or 'self'
    moderator_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("synthetic_panel.moderators.id", ondelete="SET NULL"),
        nullable=True,
    )
    discussion_guide_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("synthetic_panel.discussion_guides.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Participants (array of persona IDs)
    participant_ids = Column(ARRAY(PG_UUID(as_uuid=True)), nullable=False, default=[])

    # Settings
    language = Column(String(10), default="en")
    response_rigidity = Column(Integer, default=5)  # 1-10, how strictly to follow persona
    allow_interruptions = Column(Boolean, default=False)
    max_response_length = Column(Integer, default=500)

    # Status
    status = Column(String(20), default="draft", index=True)  # draft, ready, active, completed, archived
    started_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))

    # Knowledge Context (optional additional knowledge for panel)
    knowledge_group_ids = Column(ARRAY(PG_UUID(as_uuid=True)), default=[])

    # Access Control
    is_org_wide = Column(Boolean, default=True)  # If true, all org users can access
    cohort_ids = Column(ARRAY(PG_UUID(as_uuid=True)), default=[])  # If not org_wide, restrict to these cohorts

    # Creator
    created_by = Column(PG_UUID(as_uuid=True))  # FK to auth_service.users

    # Relationships
    moderator = relationship("Moderator", back_populates="panels")
    discussion_guide = relationship("DiscussionGuide", back_populates="panels")
    messages = relationship("PanelMessage", back_populates="panel", cascade="all, delete-orphan")
    analyses = relationship("PanelAnalysis", back_populates="panel", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Panel(id={self.id}, name='{self.name}', status='{self.status}')>"
