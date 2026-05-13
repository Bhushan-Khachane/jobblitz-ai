-- 008_application_step_events.sql
-- Granular step-level audit trail for each application run.

CREATE TABLE IF NOT EXISTS application_step_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES application_runs(id) ON DELETE CASCADE,
    step_name VARCHAR(255) NOT NULL,
    tool_name VARCHAR(100) NOT NULL,
    tool_args JSONB,
    tool_output TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    screenshot_url TEXT,
    diff_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_step_events_run_id ON application_step_events(run_id);
CREATE INDEX idx_step_events_success ON application_step_events(success);
