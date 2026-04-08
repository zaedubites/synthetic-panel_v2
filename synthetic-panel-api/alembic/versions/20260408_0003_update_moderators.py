"""Update moderators table to match reference app

Revision ID: 0003
Revises: 20240101_0002
Create Date: 2026-04-08 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "20240101_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "synthetic_panel"


def upgrade() -> None:
    # Add new columns
    op.add_column("moderators", sa.Column("type", sa.String(50), server_default="professional"), schema=SCHEMA)
    op.add_column("moderators", sa.Column("gender", sa.String(20), nullable=True), schema=SCHEMA)
    op.add_column("moderators", sa.Column("bio", sa.Text(), nullable=True), schema=SCHEMA)
    op.add_column("moderators", sa.Column("phrases", postgresql.JSONB(), nullable=True), schema=SCHEMA)
    op.add_column("moderators", sa.Column("session_count", sa.Integer(), server_default="0"), schema=SCHEMA)
    op.add_column("moderators", sa.Column("voice_name", sa.String(255), nullable=True), schema=SCHEMA)

    # Migrate description -> bio
    op.execute(f"UPDATE {SCHEMA}.moderators SET bio = description WHERE bio IS NULL AND description IS NOT NULL")

    # Change personality from Text to JSONB
    op.execute(f"""
        ALTER TABLE {SCHEMA}.moderators
        ALTER COLUMN personality TYPE jsonb
        USING CASE
            WHEN personality IS NULL THEN '{{}}'::jsonb
            WHEN personality ~ '^\\s*\\{{' THEN personality::jsonb
            ELSE jsonb_build_object('description', personality)
        END
    """)

    # Set default for personality
    op.execute(f"ALTER TABLE {SCHEMA}.moderators ALTER COLUMN personality SET DEFAULT '{{}}'::jsonb")


def downgrade() -> None:
    op.drop_column("moderators", "voice_name", schema=SCHEMA)
    op.drop_column("moderators", "session_count", schema=SCHEMA)
    op.drop_column("moderators", "phrases", schema=SCHEMA)
    op.drop_column("moderators", "bio", schema=SCHEMA)
    op.drop_column("moderators", "gender", schema=SCHEMA)
    op.drop_column("moderators", "type", schema=SCHEMA)

    # Revert personality to Text
    op.execute(f"""
        ALTER TABLE {SCHEMA}.moderators
        ALTER COLUMN personality TYPE text
        USING personality::text
    """)
