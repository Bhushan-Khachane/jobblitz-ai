"""add experience_years to profiles

Revision ID: 019_exp_years_profiles
Revises: 018_norm_hash_job_leads
Create Date: 2026-05-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "019_exp_years_profiles"
down_revision: Union[str, None] = "018_norm_hash_job_leads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("experience_years", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "experience_years")
