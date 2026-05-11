"""Add login_sessions table for Neko cloud browser sessions.

Users log into job portals through streamed Neko containers.
This table tracks active sessions with 10-minute TTL enforcement.

RLS policies using auth.uid() are only applied on Supabase-hosted databases.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers
revision = "006_login_sessions_table"
down_revision = "005_supabase_rls_policies"
branch_labels = None
depends_on = None


def _has_auth_schema() -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text("SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth'"))
    return result.fetchone() is not None


def upgrade() -> None:
    op.create_table(
        "login_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("platform", sa.String(50), nullable=False),  # linkedin / naukri
        sa.Column("container_id", sa.String(100), nullable=False),
        sa.Column("container_ip", sa.String(50), nullable=True),
        sa.Column("iframe_url", sa.Text, nullable=False),
        sa.Column("token", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="creating"),  # creating/active/cookies_saved/expired
        sa.Column("cookies_path", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Enable RLS on login_sessions (Supabase only)
    if _has_auth_schema():
        op.execute("ALTER TABLE login_sessions ENABLE ROW LEVEL SECURITY;")
        op.execute("""
            CREATE POLICY "users_own_sessions" ON login_sessions
                FOR ALL
                USING (auth.uid() = user_id);
        """)


def downgrade() -> None:
    if _has_auth_schema():
        op.execute('DROP POLICY IF EXISTS "users_own_sessions" ON login_sessions;')
        op.execute("ALTER TABLE login_sessions DISABLE ROW LEVEL SECURITY;")
    op.drop_table("login_sessions")