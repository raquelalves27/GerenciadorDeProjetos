"""Mako template for Alembic migration scripts.
"""
from alembic import op
import sqlalchemy as sa

revision = "${up_revision}"
down_revision = ${down_revision and repr(down_revision) or None}
branch_labels = ${repr(branch_labels) if branch_labels else None}
depends_on = ${repr(depends_on) if depends_on else None}

def upgrade():
    pass

def downgrade():
    pass
