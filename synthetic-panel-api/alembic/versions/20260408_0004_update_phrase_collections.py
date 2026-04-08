"""Add region, city, age_range to phrase_collections

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-08 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "synthetic_panel"


def upgrade() -> None:
    op.add_column("phrase_collections", sa.Column("region", sa.String(100), nullable=True), schema=SCHEMA)
    op.add_column("phrase_collections", sa.Column("city", sa.String(100), nullable=True), schema=SCHEMA)
    op.add_column("phrase_collections", sa.Column("age_range", sa.String(20), nullable=True), schema=SCHEMA)


def downgrade() -> None:
    op.drop_column("phrase_collections", "age_range", schema=SCHEMA)
    op.drop_column("phrase_collections", "city", schema=SCHEMA)
    op.drop_column("phrase_collections", "region", schema=SCHEMA)
