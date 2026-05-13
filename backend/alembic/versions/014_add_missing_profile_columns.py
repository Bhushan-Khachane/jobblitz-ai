"""add missing profile columns

Revision ID: 014_add_missing_profile_columns
Revises: 013_new_arch_tables
Create Date: 2026-05-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "014_add_missing_profile_columns"
down_revision: Union[str, None] = "013_new_arch_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("job_search_profiles", sa.Column("years_experience", sa.Integer(), nullable=True))
    op.add_column("job_search_profiles", sa.Column("job_age_days", sa.Integer(), nullable=True))
    op.add_column("job_leads", sa.Column("experience", sa.String(255), nullable=True))
    op.add_column("job_leads", sa.Column("salary", sa.String(255), nullable=True))
    op.add_column("job_leads", sa.Column("decision", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("job_search_profiles", "years_experience")
    op.drop_column("job_search_profiles", "job_age_days")
    op.drop_column("job_leads", "experience")
    op.drop_column("job_leads", "salary")
    op.drop_column("job_leads", "decision")
