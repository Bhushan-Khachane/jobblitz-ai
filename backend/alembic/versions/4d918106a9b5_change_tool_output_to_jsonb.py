"""change tool_output to jsonb

Revision ID: 4d918106a9b5
Revises: 014_add_missing_profile_columns
Create Date: 2026-05-13 12:55:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '4d918106a9b5'
down_revision = '014_add_missing_profile_columns'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Convert empty strings to NULL so ::jsonb cast succeeds
    op.execute("UPDATE application_step_events SET tool_output = NULL WHERE tool_output = ''")
    op.alter_column(
        'application_step_events',
        'tool_output',
        existing_type=sa.Text(),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        postgresql_using='tool_output::jsonb',
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        'application_step_events',
        'tool_output',
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=sa.Text(),
        postgresql_using='tool_output::text',
        existing_nullable=True,
    )
