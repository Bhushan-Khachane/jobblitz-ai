-- 009_agent_runs.sql
-- Full replay state for ADK agent executions.

CREATE TABLE IF NOT EXISTS agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    input_json JSONB,
    state_json JSONB,
    output_json JSONB,
    status VARCHAR(50) DEFAULT 'running',
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_runs_user_id ON agent_runs(user_id);
CREATE INDEX idx_agent_runs_agent_name ON agent_runs(agent_name);
