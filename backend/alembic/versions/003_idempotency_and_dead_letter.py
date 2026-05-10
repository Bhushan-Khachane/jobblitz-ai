"""Add idempotency_key to applications and dead_letter_logs table

Revision ID: 003
Revises: 002
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add idempotency_key column to applications
    op.add_column("applications", sa.Column("idempotency_key", sa.String(255), nullable=True))
    op.create_index("ix_applications_idempotency_key", "applications", ["idempotency_key"], unique=True)

    # Create dead_letter_logs table
    op.create_table(
        "dead_letter_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("task_name", sa.String(200), nullable=False, index=True),
        sa.Column("task_args", JSONB, nullable=True),
        sa.Column("error_message", sa.Text, nullable=False),
        sa.Column("retry_count", sa.Integer, default=0),
        sa.Column("resolved", sa.Boolean, default=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_index("ix_applications_idempotency_key", table_name="applications")
    op.drop_column("applications", "idempotency_key")
    op.drop_table("dead_letter_logs")