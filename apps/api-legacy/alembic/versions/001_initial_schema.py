"""initial schema

Revision ID: 001_initial_schema
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. users ─────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(20)),
        sa.Column("location", sa.String(255)),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── 2. profiles (user_profiles) ──────────────────────────────────────────
    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("headline", sa.String(500)),
        sa.Column("summary", sa.Text()),
        sa.Column("skills", postgresql.JSONB()),
        sa.Column("experience", postgresql.JSONB()),
        sa.Column("education", postgresql.JSONB()),
        sa.Column("certifications", postgresql.JSONB()),
        sa.Column("preferred_job_titles", postgresql.JSONB()),
        sa.Column("preferred_locations", postgresql.JSONB()),
        sa.Column("expected_salary_lpa", sa.Float()),
        sa.Column("notice_period_days", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_profiles_user_id", "profiles", ["user_id"])

    # ── 3. credentials ───────────────────────────────────────────────────────
    op.create_table(
        "credentials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("username", sa.String(255), nullable=False),
        sa.Column("encrypted_password", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_credentials_user_id", "credentials", ["user_id"])
    op.create_index("ix_credentials_user_platform", "credentials", ["user_id", "platform"])

    # ── 4. resumes ───────────────────────────────────────────────────────────
    op.create_table(
        "resumes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("parsed_text", sa.Text()),
        sa.Column("is_default", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_resumes_user_id", "resumes", ["user_id"])

    # ── 5. job_searches ──────────────────────────────────────────────────────
    op.create_table(
        "job_searches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("keywords", sa.String(500), nullable=False),
        sa.Column("location", sa.String(255)),
        sa.Column("experience_level", sa.String(50)),
        sa.Column("job_type", sa.String(50)),
        sa.Column("remote_only", sa.Boolean(), server_default="false"),
        sa.Column("salary_min_lpa", sa.Float()),
        sa.Column("salary_max_lpa", sa.Float()),
        sa.Column("extra_filters", postgresql.JSONB()),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("last_run_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_job_searches_user_id", "job_searches", ["user_id"])
    op.create_index("ix_job_searches_user_active", "job_searches", ["user_id", "is_active"])

    # ── 6. job_listings ──────────────────────────────────────────────────────
    op.create_table(
        "job_listings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "job_search_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("job_searches.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("external_job_id", sa.String(255)),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("company", sa.String(255), nullable=False),
        sa.Column("location", sa.String(255)),
        sa.Column("description", sa.Text()),
        sa.Column("apply_url", sa.Text()),
        sa.Column("salary_info", sa.String(255)),
        sa.Column("posted_date", sa.String(100)),
        sa.Column("status", sa.String(50), server_default="discovered"),
        sa.Column("extra_data", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_job_listings_user_id", "job_listings", ["user_id"])
    op.create_index("ix_job_listings_user_status", "job_listings", ["user_id", "status"])
    op.create_index("ix_job_listings_platform_extid", "job_listings", ["platform", "external_job_id"])

    # ── 7. applications ──────────────────────────────────────────────────────
    op.create_table(
        "applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_listing_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("job_listings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "resume_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("resumes.id", ondelete="SET NULL"),
        ),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("cover_letter", sa.Text()),
        sa.Column("tailored_resume_path", sa.Text()),
        sa.Column("answers_used", postgresql.JSONB()),
        sa.Column("error_message", sa.Text()),
        sa.Column("screenshot_path", sa.Text()),
        sa.Column("retry_count", sa.Integer(), server_default="0"),
        sa.Column("applied_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_applications_user_id", "applications", ["user_id"])
    op.create_index("ix_applications_job_listing_id", "applications", ["job_listing_id"])
    op.create_index("ix_applications_status", "applications", ["status"])
    op.create_index("ix_applications_user_status", "applications", ["user_id", "status"])

    # ── 8. question_answers ──────────────────────────────────────────────────
    op.create_table(
        "question_answers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column("platform", sa.String(50)),
        sa.Column("usage_count", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_question_answers_user_id", "question_answers", ["user_id"])

    # ── 9. usage_logs ────────────────────────────────────────────────────────
    op.create_table(
        "usage_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("details", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_usage_logs_user_id", "usage_logs", ["user_id"])
    op.create_index("ix_usage_logs_user_action", "usage_logs", ["user_id", "action"])


def downgrade() -> None:
    op.drop_table("usage_logs")
    op.drop_table("question_answers")
    op.drop_table("applications")
    op.drop_table("job_listings")
    op.drop_table("job_searches")
    op.drop_table("resumes")
    op.drop_table("credentials")
    op.drop_table("profiles")
    op.drop_table("users")
