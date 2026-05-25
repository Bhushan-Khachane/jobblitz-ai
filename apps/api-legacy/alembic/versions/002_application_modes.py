"""Add application mode, daily limit, match explanation, and approval status

Revision ID: 002_application_modes
Revises: 185e27f1adcf
Create Date: 2026-05-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "002_application_modes"
down_revision = "185e27f1adcf"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add application_mode and daily_apply_limit to users
    op.add_column("users", sa.Column("application_mode", sa.String(20), server_default="assisted", nullable=False))
    op.add_column("users", sa.Column("daily_apply_limit", sa.Integer(), server_default="50", nullable=False))

    # Add match_explanation to job_listings
    op.add_column("job_listings", sa.Column("match_explanation", JSONB, nullable=True))

    # Add approval_status to applications
    op.add_column("applications", sa.Column("approval_status", sa.String(20), nullable=True))

    # Add index for approval_status lookups
    op.create_index("ix_applications_approval_status", "applications", ["approval_status"])


def downgrade() -> None:
    op.drop_index("ix_applications_approval_status", table_name="applications")
    op.drop_column("applications", "approval_status")
    op.drop_column("job_listings", "match_explanation")
    op.drop_column("users", "daily_apply_limit")
    op.drop_column("users", "application_mode")