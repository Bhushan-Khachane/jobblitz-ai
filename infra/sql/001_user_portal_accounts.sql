-- 001_user_portal_accounts.sql
-- Links a user to a job portal without storing credentials.

CREATE TABLE IF NOT EXISTS user_portal_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    portal VARCHAR(50) NOT NULL, -- naukri / linkedin / indeed
    display_name VARCHAR(255),
    profile_url TEXT,
    status VARCHAR(50) DEFAULT 'disconnected', -- disconnected / connected / requires_relogin / error
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, portal)
);

CREATE INDEX idx_user_portal_accounts_user_id ON user_portal_accounts(user_id);
CREATE INDEX idx_user_portal_accounts_portal ON user_portal_accounts(portal);
