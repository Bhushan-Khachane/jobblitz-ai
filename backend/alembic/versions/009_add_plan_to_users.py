"""add plan to users

Revision ID: 8ffa36f72e5d
Revises: 008_login_sessions_cdp_url
Create Date: 2026-05-11 18:03:10.093692

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8ffa36f72e5d'
down_revision = '008_login_sessions_cdp_url'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('plan', sa.String(length=20), server_default='free', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'plan')