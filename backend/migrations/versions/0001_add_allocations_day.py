"""add allocations.day column

Revision ID: 0001_add_allocations_day
Revises: 
Create Date: 2026-05-25 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001_add_allocations_day'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add nullable date column `day` to allocations
    op.add_column('allocations', sa.Column('day', sa.Date(), nullable=True))


def downgrade():
    op.drop_column('allocations', 'day')
