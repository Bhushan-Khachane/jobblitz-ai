"""add auto_match and match_score columns

Revision ID: 185e27f1adcf
Revises: 001_initial_schema
Create Date: 2026-05-05 10:46:36.600748

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '185e27f1adcf'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('job_searches', sa.Column('auto_match', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('job_listings', sa.Column('match_score', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('job_listings', 'match_score')
    op.drop_column('job_searches', 'auto_match')
