"""Add cdp_url column to login_sessions table.

Stores the Chrome DevTools Protocol URL for each Neko session,
enabling login status checks without re-querying Docker port bindings.
"""

from alembic import op
import sqlalchemy as sa


revision = "008_login_sessions_cdp_url"
down_revision = "007_credential_session_cookies"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("login_sessions", sa.Column("cdp_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("login_sessions", "cdp_url")