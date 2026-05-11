"""Add session_cookies column to credentials table.

Stores encrypted session cookies from Neko cloud browser login sessions
separately from the password field.
"""

from alembic import op
import sqlalchemy as sa


revision = "007_credential_session_cookies"
down_revision = "006_login_sessions_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("credentials", sa.Column("session_cookies", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("credentials", "session_cookies")