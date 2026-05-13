"""add browser session evidence fields

Revision ID: 015_add_browser_session_evidence
Revises: 4d918106a9b5
Create Date: 2026-05-13 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '015_add_browser_session_evidence'
down_revision = '4d918106a9b5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('browser_sessions', sa.Column('login_method', sa.String(20), nullable=True))
    op.add_column('browser_sessions', sa.Column('verified', sa.Boolean(), nullable=True, server_default=sa.text('false')))
    op.add_column('browser_sessions', sa.Column('evidence_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('browser_sessions', 'evidence_json')
    op.drop_column('browser_sessions', 'verified')
    op.drop_column('browser_sessions', 'login_method')
