-- 010_approval_requests.sql
-- Human approval gates for low-confidence or high-risk applications.

CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'expired');

CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_lead_id UUID NOT NULL REFERENCES job_leads(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES application_plans(id) ON DELETE SET NULL,
    run_id UUID REFERENCES application_runs(id) ON DELETE SET NULL,
    fit_score FLOAT,
    reason TEXT NOT NULL,
    status approval_status DEFAULT 'pending',
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approval_requests_user_status ON approval_requests(user_id, status);
CREATE INDEX idx_approval_requests_pending ON approval_requests(status) WHERE status = 'pending';
