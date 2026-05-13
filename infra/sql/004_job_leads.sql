-- 004_job_leads.sql
-- Raw job discoveries from ADK agents.

CREATE TABLE IF NOT EXISTS job_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    search_profile_id UUID REFERENCES job_search_profiles(id) ON DELETE SET NULL,
    portal VARCHAR(50) NOT NULL,
    url TEXT NOT NULL,
    title VARCHAR(500) NOT NULL,
    company VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    jd_text TEXT,
    posted_at VARCHAR(100),
    external_job_id VARCHAR(255),
    raw_data JSONB,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_job_leads_user_portal ON job_leads(user_id, portal);
CREATE INDEX idx_job_leads_processed ON job_leads(processed);
