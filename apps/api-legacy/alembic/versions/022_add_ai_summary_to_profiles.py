"""Add ai_summary and ai_summary_updated_at to profiles

Revision ID: 022
Revises: 021_add_profile_salary_and_links
Create Date: 2026-05-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "022_add_ai_summary_to_profiles"
down_revision: Union[str, None] = "021_add_profile_salary_and_links"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("ai_summary", sa.Text(), nullable=True))
    op.add_column("profiles", sa.Column("ai_summary_updated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "ai_summary_updated_at")
    op.drop_column("profiles", "ai_summary")
