"""Add job preference fields to profiles

Revision ID: 017_add_job_preference_fields_to_profiles
Revises: 016_add_salary_experience_to_job_leads
Create Date: 2026-05-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "017_job_pref_fields_profiles"
down_revision: Union[str, None] = "016_salary_exp_job_leads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("salary_min_lpa", sa.Float(), nullable=True))
    op.add_column("profiles", sa.Column("salary_max_lpa", sa.Float(), nullable=True))
    op.add_column("profiles", sa.Column("experience_level", sa.String(50), nullable=True))
    op.add_column("profiles", sa.Column("remote_only", sa.Boolean(), nullable=True))
    op.add_column("profiles", sa.Column("target_portals", postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "target_portals")
    op.drop_column("profiles", "remote_only")
    op.drop_column("profiles", "experience_level")
    op.drop_column("profiles", "salary_max_lpa")
    op.drop_column("profiles", "salary_min_lpa")
