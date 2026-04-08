"""
Pydantic schemas for Panel endpoints.
"""
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import ConfigDict, Field, field_validator, model_validator

from app.schemas.common import BaseSchema, IDSchema, TimestampSchema


class PanelBase(BaseSchema):
    """Base panel fields."""

    name: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    research_goal: Optional[str] = None
    moderation_mode: str = Field(default="ai", pattern="^(ai|self)$")
    moderator_id: Optional[UUID] = None
    discussion_guide_id: Optional[UUID] = None
    participant_ids: list[UUID] = Field(default_factory=list)
    language: str = Field(default="en", max_length=10)
    response_rigidity: int = Field(default=5, ge=1, le=10)
    allow_interruptions: bool = False
    max_response_length: int = Field(default=500, ge=50, le=2000)
    knowledge_group_ids: list[UUID] = Field(default_factory=list)
    is_org_wide: bool = True
    cohort_ids: list[UUID] = Field(default_factory=list)


class PanelCreate(PanelBase):
    """Schema for creating a panel. Accepts extra fields from frontend."""

    model_config = ConfigDict(extra="ignore")

    # Frontend sends persona_ids instead of participant_ids
    persona_ids: Optional[list[UUID]] = None
    target_duration_minutes: Optional[int] = None


class PanelUpdate(BaseSchema):
    """Schema for updating a panel."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    research_goal: Optional[str] = None
    moderation_mode: Optional[str] = Field(default=None, pattern="^(ai|self)$")
    moderator_id: Optional[UUID] = None
    discussion_guide_id: Optional[UUID] = None
    participant_ids: Optional[list[UUID]] = None
    language: Optional[str] = Field(default=None, max_length=10)
    response_rigidity: Optional[int] = Field(default=None, ge=1, le=10)
    allow_interruptions: Optional[bool] = None
    max_response_length: Optional[int] = Field(default=None, ge=50, le=2000)
    knowledge_group_ids: Optional[list[UUID]] = None
    is_org_wide: Optional[bool] = None
    cohort_ids: Optional[list[UUID]] = None


class PanelResponse(PanelBase, IDSchema, TimestampSchema):
    """Schema for panel response."""

    organization_id: UUID
    status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_by: Optional[UUID] = None


class PanelListResponse(BaseSchema):
    """Schema for paginated panel list."""

    items: list[PanelResponse]
    total: int
    page: int
    page_size: int


class PanelMessageBase(BaseSchema):
    """Base panel message fields."""

    role: str = Field(..., pattern="^(moderator|persona|user|system)$")
    persona_id: Optional[UUID] = None
    content: str = Field(..., min_length=1)


class PanelMessageCreate(PanelMessageBase):
    """Schema for creating a panel message."""

    pass


class PanelMessageResponse(PanelMessageBase, IDSchema):
    """Schema for panel message response."""

    panel_id: UUID
    audio_url: Optional[str] = None
    message_metadata: dict[str, Any] = Field(default_factory=dict)
    sequence_number: int
    created_at: datetime
    persona_name: Optional[str] = None

    @model_validator(mode="after")
    def extract_persona_name(self):
        if self.persona_name is None and self.message_metadata:
            self.persona_name = self.message_metadata.get("persona_name")
        return self


class PanelTranscriptResponse(BaseSchema):
    """Schema for full panel transcript."""

    panel_id: UUID
    messages: list[PanelMessageResponse]
    total_messages: int


class PanelAnalysisType(BaseSchema):
    """Analysis type enumeration."""

    type: str = Field(..., pattern="^(consensus|disagreements|trends|summary|key_quotes|recommendations)$")


class PanelAnalysisResponse(IDSchema):
    """Schema for panel analysis response."""

    panel_id: UUID
    analysis_type: str
    content: Optional[str] = None
    structured_data: dict[str, Any] = Field(default_factory=dict)
    model_used: Optional[str] = None
    generated_at: datetime


class PanelAnalysisListResponse(BaseSchema):
    """Schema for all panel analyses."""

    panel_id: UUID
    analyses: list[PanelAnalysisResponse]


# Session endpoints

class PanelPrepareRequest(BaseSchema):
    """Request to prepare panel session."""

    load_knowledge: bool = True


class PanelPrepareResponse(BaseSchema):
    """Response after preparing panel."""

    panel_id: UUID
    status: str
    participants_loaded: int
    knowledge_loaded: bool


class PanelStartRequest(BaseSchema):
    """Request to start panel session."""

    pass


class PanelStartResponse(BaseSchema):
    """Response after starting panel."""

    panel_id: UUID
    status: str
    started_at: datetime
    websocket_url: str


class PanelEndRequest(BaseSchema):
    """Request to end panel session."""

    generate_analysis: bool = True


class PanelEndResponse(BaseSchema):
    """Response after ending panel."""

    panel_id: UUID
    status: str
    ended_at: datetime
    total_messages: int


class PanelSendMessageRequest(BaseSchema):
    """Request to send a message to the panel."""

    message: str = Field(..., min_length=1)
    target_persona_ids: Optional[list[UUID]] = None  # None = all participants


class PanelSendMessageResponse(BaseSchema):
    """Response from sending a message."""

    user_message: PanelMessageResponse
    responses: list[PanelMessageResponse]


class PanelGenerateFollowupsRequest(BaseSchema):
    """Request to generate follow-up questions."""

    count: int = Field(default=3, ge=1, le=5)
    based_on_last: int = Field(default=5, ge=1, le=20)  # Number of recent messages to consider


class PanelGenerateFollowupsResponse(BaseSchema):
    """Response with generated follow-up questions."""

    panel_id: UUID
    followups: list[str]


class PanelRaiseHandRequest(BaseSchema):
    """Request for persona to raise hand."""

    persona_id: UUID
    topic: Optional[str] = None


class PanelRaiseHandResponse(BaseSchema):
    """Response from raise hand."""

    persona_id: UUID
    acknowledged: bool
    queue_position: int


class PanelRegenerateAnalysisRequest(BaseSchema):
    """Request to regenerate specific analysis types."""

    analysis_types: list[str] = Field(default_factory=lambda: ["summary"])
