"""
Panel Analysis model - Generated insights from panel sessions.
"""
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import BaseModel


class PanelAnalysis(BaseModel):
    """
    AI-generated analysis of a panel session.
    Multiple analysis types per panel (consensus, trends, etc.).
    """

    __tablename__ = "panel_analyses"
    __table_args__ = (
        UniqueConstraint("panel_id", "analysis_type", name="uq_panel_analysis_type"),
        {"schema": "synthetic_panel"},
    )

    # Parent panel
    panel_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("synthetic_panel.panels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Analysis type
    # Types: consensus, disagreements, trends, summary, key_quotes, recommendations
    analysis_type = Column(String(50), nullable=False)

    # Content
    content = Column(Text)  # Markdown/text content

    # Structured data for visualization
    # Example for consensus:
    # {
    #     "points": [
    #         {"statement": "...", "agreement_level": 0.9, "participants": ["p1", "p2"]},
    #         ...
    #     ]
    # }
    structured_data = Column(JSONB, default={})

    # Generation metadata
    model_used = Column(String(100))
    generated_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    panel = relationship("Panel", back_populates="analyses")

    def __repr__(self) -> str:
        return f"<PanelAnalysis(id={self.id}, panel={self.panel_id}, type='{self.analysis_type}')>"
