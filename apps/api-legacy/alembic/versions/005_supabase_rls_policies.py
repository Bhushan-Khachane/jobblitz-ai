"""Enable Row Level Security on all user-data tables.

This migration adds Supabase RLS policies to ensure users can only
access their own data. Each policy uses auth.uid() to filter rows.

On non-Supabase databases (local Docker Postgres), the auth schema
doesn't exist, so this migration is a no-op.

Reversible: downgrade() drops policies and disables RLS.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "005_supabase_rls_policies"
down_revision = "003_idempotency_and_dead_letter"
branch_labels = None
depends_on = None


# Tables that need RLS (all user-scoped tables)
RLS_TABLES = [
    "profiles",
    "credentials",
    "resumes",
    "job_searches",
    "job_listings",
    "applications",
    "question_answers",
    "usage_logs",
]


def _has_auth_schema() -> bool:
    """Check if the Supabase auth schema exists in the current database."""
    conn = op.get_bind()
    result = conn.execute(sa.text("SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth'"))
    return result.fetchone() is not None


def upgrade() -> None:
    """Enable RLS and create policies for all user-data tables.

    Skipped on non-Supabase databases where the auth schema doesn't exist.
    """
    if not _has_auth_schema():
        # Local Docker Postgres — no Supabase auth schema, skip RLS setup
        return

    for table in RLS_TABLES:
        # Enable RLS
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")

        # Create policy: users can only see their own data
        op.execute(f"""
            CREATE POLICY "users_own_data" ON {table}
                FOR ALL
                USING (auth.uid() = user_id);
        """)

    # applications table: also allow reads by user_id
    op.execute("""
        CREATE POLICY "users_own_applications" ON applications
            FOR ALL
            USING (auth.uid() = user_id);
    """)

    # dead_letter_logs: service-role only (no user RLS)
    op.execute("ALTER TABLE dead_letter_logs ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY "service_role_only" ON dead_letter_logs
            FOR ALL
            USING (auth.role() = 'service_role');
    """)


def downgrade() -> None:
    """Drop policies and disable RLS."""
    if not _has_auth_schema():
        return

    for table in RLS_TABLES:
        op.execute(f'DROP POLICY IF EXISTS "users_own_data" ON {table};')
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")

    op.execute('DROP POLICY IF EXISTS "users_own_applications" ON applications;')
    op.execute('DROP POLICY IF EXISTS "service_role_only" ON dead_letter_logs;')
    op.execute("ALTER TABLE dead_letter_logs DISABLE ROW LEVEL SECURITY;")