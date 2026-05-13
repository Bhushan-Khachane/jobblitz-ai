-- 007_application_runs.sql
-- Execution runs for job applications.

CREATE TYPE application_run_status AS ENUM ('queued', 'running', 'success', 'failed', 'blocked', 'skipped');

CREATE TABLE IF NOT EXISTS application_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_lead_id UUID NOT NULL REFERENCES job_leads(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES application_plans(id) ON DELETE SET NULL,
    status application_run_status DEFAULT 'queued',
    error_message TEXT,
    retry_count INT DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_application_runs_user_status ON application_runs(user_id, status);
CREATE INDEX idx_application_runs_job_lead ON application_runs(job_lead_id);
