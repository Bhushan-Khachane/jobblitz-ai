-- 002_browser_sessions.sql
-- Isolated browser sessions per user per portal.

CREATE TYPE browser_session_status AS ENUM ('pending_login', 'active', 'expired', 'error');

CREATE TABLE IF NOT EXISTS browser_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    portal VARCHAR(50) NOT NULL,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    status browser_session_status DEFAULT 'pending_login',
    cookies_path TEXT,
    last_verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_browser_sessions_user_portal ON browser_sessions(user_id, portal);
CREATE INDEX idx_browser_sessions_status ON browser_sessions(status);
