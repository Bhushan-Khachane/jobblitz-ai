"""Add job_recommendations table and profile_parser fields

Revision ID: 023
Revises: 022_add_ai_summary_to_profiles
Create Date: 2026-05-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "023_add_job_recommendations"
down_revision: Union[str, None] = "022_add_ai_summary_to_profiles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add parsed_profile fields to profiles
    op.add_column("profiles", sa.Column("parsed_profile", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("profiles", sa.Column("profile_parsed_at", sa.DateTime(timezone=True), nullable=True))

    # Create job_recommendations table
    op.create_table(
        "job_recommendations",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("job_id", sa.String(255), nullable=False),
        sa.Column("company", sa.String(500), nullable=True),
        sa.Column("role", sa.String(500), nullable=True),
        sa.Column("location", sa.String(300), nullable=True),
        sa.Column("job_type", sa.String(50), nullable=True),
        sa.Column("experience_required", sa.String(100), nullable=True),
        sa.Column("salary_estimate", sa.String(100), nullable=True),
        sa.Column("match_score", sa.Float(), nullable=False),
        sa.Column("match_score_pct", sa.Integer(), nullable=False),
        sa.Column("priority_tier", sa.String(20), nullable=True),
        sa.Column("skill_breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("apply_link", sa.Text(), nullable=True),
        sa.Column("source_portal", sa.String(100), nullable=True),
        sa.Column("raw_description", sa.Text(), nullable=True),
        sa.Column("discovered_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(50), server_default="discovered"),
        sa.UniqueConstraint("user_id", "job_id", name="uq_job_recs_user_job"),
    )
    op.create_index("idx_job_recs_user_score", "job_recommendations", ["user_id", sa.text("match_score DESC")])
    op.create_index("idx_job_recs_tier", "job_recommendations", ["user_id", "priority_tier"])
    op.create_index("idx_job_recs_status", "job_recommendations", ["user_id", "status"])


def downgrade() -> None:
    op.drop_index("idx_job_recs_status", table_name="job_recommendations")
    op.drop_index("idx_job_recs_tier", table_name="job_recommendations")
    op.drop_index("idx_job_recs_user_score", table_name="job_recommendations")
    op.drop_table("job_recommendations")
    op.drop_column("profiles", "profile_parsed_at")
    op.drop_column("profiles", "parsed_profile")
