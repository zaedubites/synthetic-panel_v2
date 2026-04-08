"""Initial schema for Synthetic Panel

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20240101_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "synthetic_panel"


def upgrade() -> None:
    # Create schema
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")

    # Create frameworks table
    op.create_table(
        "frameworks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("dimensions", postgresql.JSONB(), nullable=True, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index("idx_frameworks_org", "frameworks", ["organization_id"], schema=SCHEMA)

    # Create archetypes table
    op.create_table(
        "archetypes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("driver", sa.Text(), nullable=True),
        sa.Column("core_value", sa.Text(), nullable=True),
        sa.Column("key_behaviors", postgresql.ARRAY(sa.Text()), nullable=True, server_default="{}"),
        sa.Column("communication_patterns", postgresql.ARRAY(sa.Text()), nullable=True, server_default="{}"),
        sa.Column("age_min", sa.Integer(), nullable=True),
        sa.Column("age_max", sa.Integer(), nullable=True),
        sa.Column("generation", sa.String(50), nullable=True),
        sa.Column("location_type", sa.String(50), nullable=True),
        sa.Column("demographic_tags", postgresql.ARRAY(sa.Text()), nullable=True, server_default="{}"),
        sa.Column("example_quotes", postgresql.ARRAY(sa.Text()), nullable=True, server_default="{}"),
        sa.Column("example_interests", postgresql.ARRAY(sa.Text()), nullable=True, server_default="{}"),
        sa.Column("source_knowledge_group_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index("idx_archetypes_org", "archetypes", ["organization_id"], schema=SCHEMA)

    # Create personas table
    op.create_table(
        "personas",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("gender", sa.String(50), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("education", sa.String(100), nullable=True),
        sa.Column("occupation", sa.String(255), nullable=True),
        sa.Column("personality", sa.Text(), nullable=True),
        sa.Column("quirks", postgresql.ARRAY(sa.Text()), nullable=True, server_default="{}"),
        sa.Column("catchphrases", postgresql.ARRAY(sa.Text()), nullable=True, server_default="{}"),
        sa.Column("backstory", sa.Text(), nullable=True),
        sa.Column("worldview", sa.Text(), nullable=True),
        sa.Column("consumer_habits", sa.Text(), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("appearance_prompt", sa.Text(), nullable=True),
        sa.Column("voice_id", sa.String(100), nullable=True),
        sa.Column("voice_settings", postgresql.JSONB(), nullable=True, server_default="{}"),
        sa.Column("knowledge_group_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("psychological_framework_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("archetype_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("language", sa.String(10), nullable=True, server_default="en"),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["psychological_framework_id"], [f"{SCHEMA}.frameworks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["archetype_id"], [f"{SCHEMA}.archetypes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index("idx_personas_org", "personas", ["organization_id"], schema=SCHEMA)
    op.create_index("idx_personas_knowledge", "personas", ["knowledge_group_id"], schema=SCHEMA)

    # Create moderators table
    op.create_table(
        "moderators",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("personality", sa.Text(), nullable=True),
        sa.Column("moderation_style", sa.String(50), nullable=True, server_default="professional"),
        sa.Column("warmth_level", sa.Integer(), nullable=True, server_default="5"),
        sa.Column("voice_id", sa.String(100), nullable=True),
        sa.Column("voice_settings", postgresql.JSONB(), nullable=True, server_default="{}"),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=True, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index("idx_moderators_org", "moderators", ["organization_id"], schema=SCHEMA)

    # Create discussion_guides table
    op.create_table(
        "discussion_guides",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("questions", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("language", sa.String(10), nullable=True, server_default="en"),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index("idx_discussion_guides_org", "discussion_guides", ["organization_id"], schema=SCHEMA)

    # Create panels table
    op.create_table(
        "panels",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("research_goal", sa.Text(), nullable=True),
        sa.Column("moderation_mode", sa.String(20), nullable=True, server_default="ai"),
        sa.Column("moderator_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("discussion_guide_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("participant_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=False, server_default="{}"),
        sa.Column("language", sa.String(10), nullable=True, server_default="en"),
        sa.Column("response_rigidity", sa.Integer(), nullable=True, server_default="5"),
        sa.Column("allow_interruptions", sa.Boolean(), nullable=True, server_default="false"),
        sa.Column("max_response_length", sa.Integer(), nullable=True, server_default="500"),
        sa.Column("status", sa.String(20), nullable=True, server_default="draft"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("knowledge_group_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True, server_default="{}"),
        sa.Column("is_org_wide", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("cohort_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True, server_default="{}"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["moderator_id"], [f"{SCHEMA}.moderators.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["discussion_guide_id"], [f"{SCHEMA}.discussion_guides.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index("idx_panels_org", "panels", ["organization_id"], schema=SCHEMA)
    op.create_index("idx_panels_status", "panels", ["organization_id", "status"], schema=SCHEMA)

    # Create panel_messages table
    op.create_table(
        "panel_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("panel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("persona_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("audio_url", sa.Text(), nullable=True),
        sa.Column("message_metadata", postgresql.JSONB(), nullable=True, server_default="{}"),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["panel_id"], [f"{SCHEMA}.panels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index("idx_panel_messages_panel", "panel_messages", ["panel_id", "sequence_number"], schema=SCHEMA)

    # Create panel_analyses table
    op.create_table(
        "panel_analyses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("panel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("analysis_type", sa.String(50), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("structured_data", postgresql.JSONB(), nullable=True, server_default="{}"),
        sa.Column("model_used", sa.String(100), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["panel_id"], [f"{SCHEMA}.panels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("panel_id", "analysis_type", name="uq_panel_analysis_type"),
        schema=SCHEMA,
    )

    # Create phrase_collections table
    op.create_table(
        "phrase_collections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("generation", sa.String(50), nullable=True),
        sa.Column("language", sa.String(10), nullable=True, server_default="en"),
        sa.Column("phrases", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )

    # Create voice_presets table
    op.create_table(
        "voice_presets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("provider", sa.String(50), nullable=True, server_default="elevenlabs"),
        sa.Column("voice_id", sa.String(100), nullable=False),
        sa.Column("voice_name", sa.String(255), nullable=True),
        sa.Column("settings", postgresql.JSONB(), nullable=True, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index("idx_voice_presets_org", "voice_presets", ["organization_id"], schema=SCHEMA)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("voice_presets", schema=SCHEMA)
    op.drop_table("phrase_collections", schema=SCHEMA)
    op.drop_table("panel_analyses", schema=SCHEMA)
    op.drop_table("panel_messages", schema=SCHEMA)
    op.drop_table("panels", schema=SCHEMA)
    op.drop_table("discussion_guides", schema=SCHEMA)
    op.drop_table("moderators", schema=SCHEMA)
    op.drop_table("personas", schema=SCHEMA)
    op.drop_table("archetypes", schema=SCHEMA)
    op.drop_table("frameworks", schema=SCHEMA)

    # Drop schema
    op.execute(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE")
