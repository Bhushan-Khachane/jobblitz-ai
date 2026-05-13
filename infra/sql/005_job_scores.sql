-- 005_job_scores.sql
-- Fit scores produced by the screening agent.

CREATE TABLE IF NOT EXISTS job_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_lead_id UUID NOT NULL REFERENCES job_leads(id) ON DELETE CASCADE,
    fit_score FLOAT NOT NULL CHECK (fit_score >= 0 AND fit_score <= 100),
    must_have_match JSONB,
    gap_notes TEXT,
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('auto', 'approve', 'skip')),
    scored_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, job_lead_id)
);

CREATE INDEX idx_job_scores_user_id ON job_scores(user_id);
CREATE INDEX idx_job_scores_fit_score ON job_scores(fit_score);
