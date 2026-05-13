-- 003_job_search_profiles.sql
-- Enhanced search configuration for ADK discovery agents.

CREATE TABLE IF NOT EXISTS job_search_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    keywords VARCHAR(500) NOT NULL,
    locations JSONB,
    experience_level VARCHAR(50),
    job_type VARCHAR(50),
    remote_only BOOLEAN DEFAULT FALSE,
    salary_min_lpa FLOAT,
    salary_max_lpa FLOAT,
    portals JSONB, -- list of portals to target
    extra_filters JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_search_profiles_user_active ON job_search_profiles(user_id, is_active);
