"""add tasks table

Revision ID: 0002_add_tasks_table
Revises: 0001_add_allocations_day
Create Date: 2026-07-05 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002_add_tasks_table'
down_revision = '0001_add_allocations_day'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'tasks',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('org_id', sa.String(), nullable=False),
        sa.Column('client_id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='a_fazer'),
        sa.Column('impact', sa.String(), nullable=False, server_default='medio'),
        sa.Column('is_blocker', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('responsible', sa.String(), nullable=True),
        sa.Column('waiting_on', sa.String(), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('due_note', sa.String(), nullable=True),
        sa.Column('escalate_to_manager', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('escalation_reason', sa.String(), nullable=True),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id']),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tasks_org_id', 'tasks', ['org_id'])
    op.create_index('ix_tasks_client_id', 'tasks', ['client_id'])
    op.create_index('ix_tasks_project_id', 'tasks', ['project_id'])
    op.create_index('ix_tasks_status', 'tasks', ['status'])
    op.create_index('ix_tasks_impact', 'tasks', ['impact'])
    op.create_index('ix_tasks_is_blocker', 'tasks', ['is_blocker'])
    op.create_index('ix_tasks_escalate_to_manager', 'tasks', ['escalate_to_manager'])


def downgrade():
    op.drop_index('ix_tasks_escalate_to_manager', table_name='tasks')
    op.drop_index('ix_tasks_is_blocker', table_name='tasks')
    op.drop_index('ix_tasks_impact', table_name='tasks')
    op.drop_index('ix_tasks_status', table_name='tasks')
    op.drop_index('ix_tasks_project_id', table_name='tasks')
    op.drop_index('ix_tasks_client_id', table_name='tasks')
    op.drop_index('ix_tasks_org_id', table_name='tasks')
    op.drop_table('tasks')
