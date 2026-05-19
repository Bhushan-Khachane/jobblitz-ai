"""add normalized_hash to job_leads

Revision ID: 018_norm_hash_job_leads
Revises: 017_job_pref_fields_profiles
Create Date: 2026-05-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "018_norm_hash_job_leads"
down_revision: Union[str, None] = "017_job_pref_fields_profiles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("job_leads", sa.Column("normalized_hash", sa.String(64), nullable=True))
    op.create_index("ix_job_leads_hash", "job_leads", ["normalized_hash"])


def downgrade() -> None:
    op.drop_index("ix_job_leads_hash", table_name="job_leads")
    op.drop_column("job_leads", "normalized_hash")
