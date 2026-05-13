-- 012_audit_events.sql
-- Compliance audit trail for all agent and worker actions.

CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    actor VARCHAR(50) NOT NULL, -- agent_name / user / system
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX idx_audit_events_actor ON audit_events(actor);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at);
