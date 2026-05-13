-- 006_application_plans.sql
-- AI-generated application plans before execution.

CREATE TABLE IF NOT EXISTS application_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_lead_id UUID NOT NULL REFERENCES job_leads(id) ON DELETE CASCADE,
    fields JSONB NOT NULL, -- list of {ref, type, value}
    resume_variant TEXT,
    cover_letter TEXT,
    requires_approval BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_application_plans_user_id ON application_plans(user_id);
CREATE INDEX idx_application_plans_requires_approval ON application_plans(requires_approval);
