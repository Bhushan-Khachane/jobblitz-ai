"""new arch tables for 3-plane architecture

Revision ID: 013_new_arch_tables
Revises: 8ffa36f72e5d
Create Date: 2026-05-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "013_new_arch_tables"
down_revision: Union[str, None] = "8ffa36f72e5d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enums ──────────────────────────────────────────────────────────────────
    browser_session_status = postgresql.ENUM(
        "pending_login", "active", "expired", "error",
        name="browser_session_status",
        create_type=True,
    )
    browser_session_status.create(op.get_bind(), checkfirst=True)

    application_run_status = postgresql.ENUM(
        "queued", "running", "success", "failed", "blocked", "skipped",
        name="application_run_status",
        create_type=True,
    )
    application_run_status.create(op.get_bind(), checkfirst=True)

    approval_status = postgresql.ENUM(
        "pending", "approved", "rejected", "expired",
        name="approval_status",
        create_type=True,
    )
    approval_status.create(op.get_bind(), checkfirst=True)

    # ── 1. user_portal_accounts ────────────────────────────────────────────────
    op.create_table(
        "user_portal_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("portal", sa.String(50), nullable=False),
        sa.Column("display_name", sa.String(255)),
        sa.Column("profile_url", sa.Text()),
        sa.Column("status", sa.String(50), server_default="disconnected"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_user_portal_accounts_user_id", "user_portal_accounts", ["user_id"])
    op.create_index("ix_user_portal_accounts_portal", "user_portal_accounts", ["portal"])
    op.create_unique_constraint("uq_user_portal", "user_portal_accounts", ["user_id", "portal"])

    # ── 2. browser_sessions ────────────────────────────────────────────────────
    op.create_table(
        "browser_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("portal", sa.String(50), nullable=False),
        sa.Column("session_id", sa.String(255), nullable=False, unique=True),
        sa.Column("status", sa.String(20), server_default="pending_login"),
        sa.Column("cookies_path", sa.Text()),
        sa.Column("last_verified_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_browser_sessions_user_portal", "browser_sessions", ["user_id", "portal"])
    op.create_index("ix_browser_sessions_status", "browser_sessions", ["status"])

    # ── 3. job_search_profiles ───────────────────────────────────────────────
    op.create_table(
        "job_search_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("keywords", sa.String(500), nullable=False),
        sa.Column("locations", postgresql.JSONB()),
        sa.Column("experience_level", sa.String(50)),
        sa.Column("job_type", sa.String(50)),
        sa.Column("remote_only", sa.Boolean(), server_default="false"),
        sa.Column("salary_min_lpa", sa.Float()),
        sa.Column("salary_max_lpa", sa.Float()),
        sa.Column("portals", postgresql.JSONB()),
        sa.Column("extra_filters", postgresql.JSONB()),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_job_search_profiles_user_active", "job_search_profiles", ["user_id", "is_active"])

    # ── 4. job_leads ─────────────────────────────────────────────────────────
    op.create_table(
        "job_leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("search_profile_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("job_search_profiles.id", ondelete="SET NULL")),
        sa.Column("portal", sa.String(50), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("company", sa.String(255), nullable=False),
        sa.Column("location", sa.String(255)),
        sa.Column("jd_text", sa.Text()),
        sa.Column("posted_at", sa.String(100)),
        sa.Column("external_job_id", sa.String(255)),
        sa.Column("raw_data", postgresql.JSONB()),
        sa.Column("discovered_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("processed", sa.Boolean(), server_default="false"),
    )
    op.create_index("ix_job_leads_user_portal", "job_leads", ["user_id", "portal"])
    op.create_index("ix_job_leads_processed", "job_leads", ["processed"])

    # ── 5. job_scores ────────────────────────────────────────────────────────
    op.create_table(
        "job_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("job_leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fit_score", sa.Float(), nullable=False),
        sa.Column("must_have_match", postgresql.JSONB()),
        sa.Column("gap_notes", sa.Text()),
        sa.Column("decision", sa.String(20), nullable=False),
        sa.Column("scored_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_job_scores_user_id", "job_scores", ["user_id"])
    op.create_index("ix_job_scores_fit_score", "job_scores", ["fit_score"])
    op.create_unique_constraint("uq_job_scores_user_lead", "job_scores", ["user_id", "job_lead_id"])

    # ── 6. application_plans ───────────────────────────────────────────────────
    op.create_table(
        "application_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("job_leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fields", postgresql.JSONB(), nullable=False),
        sa.Column("resume_variant", sa.Text()),
        sa.Column("cover_letter", sa.Text()),
        sa.Column("requires_approval", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_application_plans_user_id", "application_plans", ["user_id"])
    op.create_index("ix_application_plans_requires_approval", "application_plans", ["requires_approval"])

    # ── 7. application_runs ────────────────────────────────────────────────────
    op.create_table(
        "application_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("job_leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("application_plans.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(20), server_default="queued"),
        sa.Column("error_message", sa.Text()),
        sa.Column("retry_count", sa.Integer(), server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_application_runs_user_status", "application_runs", ["user_id", "status"])
    op.create_index("ix_application_runs_job_lead", "application_runs", ["job_lead_id"])

    # ── 8. application_step_events ─────────────────────────────────────────────
    op.create_table(
        "application_step_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("application_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_name", sa.String(255), nullable=False),
        sa.Column("tool_name", sa.String(100), nullable=False),
        sa.Column("tool_args", postgresql.JSONB()),
        sa.Column("tool_output", sa.Text()),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("error_message", sa.Text()),
        sa.Column("screenshot_url", sa.Text()),
        sa.Column("diff_text", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_step_events_run_id", "application_step_events", ["run_id"])
    op.create_index("ix_step_events_success", "application_step_events", ["success"])

    # ── 9. agent_runs ────────────────────────────────────────────────────────
    op.create_table(
        "agent_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("agent_name", sa.String(100), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("input_json", postgresql.JSONB()),
        sa.Column("state_json", postgresql.JSONB()),
        sa.Column("output_json", postgresql.JSONB()),
        sa.Column("status", sa.String(50), server_default="running"),
        sa.Column("error_message", sa.Text()),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_agent_runs_user_id", "agent_runs", ["user_id"])
    op.create_index("ix_agent_runs_agent_name", "agent_runs", ["agent_name"])

    # ── 10. approval_requests ────────────────────────────────────────────────
    op.create_table(
        "approval_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("job_leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("application_plans.id", ondelete="SET NULL")),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("application_runs.id", ondelete="SET NULL")),
        sa.Column("fit_score", sa.Float()),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_approval_requests_user_status", "approval_requests", ["user_id", "status"])

    # ── 11. portal_inbox_events ──────────────────────────────────────────────
    op.create_table(
        "portal_inbox_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("portal", sa.String(50), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("job_title", sa.String(500)),
        sa.Column("company", sa.String(255)),
        sa.Column("event_data", postgresql.JSONB()),
        sa.Column("read", sa.Boolean(), server_default="false"),
        sa.Column("occurred_at", sa.DateTime(timezone=True)),
        sa.Column("synced_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_portal_inbox_events_user_portal", "portal_inbox_events", ["user_id", "portal"])
    op.create_index("ix_portal_inbox_events_read", "portal_inbox_events", ["read"])

    # ── 12. audit_events ───────────────────────────────────────────────────────
    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("actor", sa.String(50), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True)),
        sa.Column("details", postgresql.JSONB()),
        sa.Column("ip_address", postgresql.INET()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_events_user_id", "audit_events", ["user_id"])
    op.create_index("ix_audit_events_actor", "audit_events", ["actor"])
    op.create_index("ix_audit_events_created_at", "audit_events", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("portal_inbox_events")
    op.drop_table("approval_requests")
    op.drop_table("agent_runs")
    op.drop_table("application_step_events")
    op.drop_table("application_runs")
    op.drop_table("application_plans")
    op.drop_table("job_scores")
    op.drop_table("job_leads")
    op.drop_table("job_search_profiles")
    op.drop_table("browser_sessions")
    op.drop_table("user_portal_accounts")

    postgresql.ENUM(name="browser_session_status").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="application_run_status").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="approval_status").drop(op.get_bind(), checkfirst=True)
