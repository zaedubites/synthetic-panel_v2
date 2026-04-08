"""Add usage_records table

Revision ID: 20240101_0002
Revises: 20240101_0001
Create Date: 2024-01-01 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20240101_0002'
down_revision: Union[str, None] = '20240101_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create usage_records table
    op.create_table(
        'usage_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('panel_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            'usage_type',
            sa.String(50),
            nullable=False
        ),
        sa.Column('quantity', sa.Integer(), nullable=False, default=1),
        sa.Column('tokens_used', sa.Integer(), nullable=True),
        sa.Column('cost_cents', sa.Integer(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema='synthetic_panel'
    )

    # Create indexes for common queries
    op.create_index(
        'ix_usage_records_organization_id',
        'usage_records',
        ['organization_id'],
        schema='synthetic_panel'
    )

    op.create_index(
        'ix_usage_records_created_at',
        'usage_records',
        ['created_at'],
        schema='synthetic_panel'
    )

    op.create_index(
        'ix_usage_records_usage_type',
        'usage_records',
        ['usage_type'],
        schema='synthetic_panel'
    )

    op.create_index(
        'ix_usage_records_panel_id',
        'usage_records',
        ['panel_id'],
        schema='synthetic_panel'
    )

    # Composite index for common reporting queries
    op.create_index(
        'ix_usage_records_org_type_date',
        'usage_records',
        ['organization_id', 'usage_type', 'created_at'],
        schema='synthetic_panel'
    )


def downgrade() -> None:
    op.drop_index('ix_usage_records_org_type_date', schema='synthetic_panel')
    op.drop_index('ix_usage_records_panel_id', schema='synthetic_panel')
    op.drop_index('ix_usage_records_usage_type', schema='synthetic_panel')
    op.drop_index('ix_usage_records_created_at', schema='synthetic_panel')
    op.drop_index('ix_usage_records_organization_id', schema='synthetic_panel')
    op.drop_table('usage_records', schema='synthetic_panel')
