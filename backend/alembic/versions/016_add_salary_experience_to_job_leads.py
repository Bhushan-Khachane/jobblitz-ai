"""Add salary and experience columns to job_leads

Revision ID: 016_add_salary_experience_to_job_leads
Revises: 015_add_browser_session_evidence
Create Date: 2026-05-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "016_add_salary_experience_to_job_leads"
down_revision: Union[str, None] = "015_add_browser_session_evidence"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("job_leads", sa.Column("experience", sa.String(255), nullable=True))
    op.add_column("job_leads", sa.Column("salary", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("job_leads", "salary")
    op.drop_column("job_leads", "experience")
