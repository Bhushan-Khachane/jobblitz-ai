"""Add current_ctc, languages, job_type, work_mode, links to profiles

Revision ID: 021
Revises: 020
Create Date: 2026-05-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "021_add_profile_salary_and_links"
down_revision: Union[str, None] = "020_qa_unique_constraint"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("current_ctc_lpa", sa.Float(), nullable=True))
    op.add_column("profiles", sa.Column("current_fixed_lpa", sa.Float(), nullable=True))
    op.add_column("profiles", sa.Column("current_variable_lpa", sa.Float(), nullable=True))
    op.add_column("profiles", sa.Column("languages", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("profiles", sa.Column("job_type", sa.String(length=50), nullable=True))
    op.add_column("profiles", sa.Column("work_mode", sa.String(length=50), nullable=True))
    op.add_column("profiles", sa.Column("portfolio_url", sa.String(length=500), nullable=True))
    op.add_column("profiles", sa.Column("linkedin_url", sa.String(length=500), nullable=True))
    op.add_column("profiles", sa.Column("github_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "github_url")
    op.drop_column("profiles", "linkedin_url")
    op.drop_column("profiles", "portfolio_url")
    op.drop_column("profiles", "work_mode")
    op.drop_column("profiles", "job_type")
    op.drop_column("profiles", "languages")
    op.drop_column("profiles", "current_variable_lpa")
    op.drop_column("profiles", "current_fixed_lpa")
    op.drop_column("profiles", "current_ctc_lpa")
