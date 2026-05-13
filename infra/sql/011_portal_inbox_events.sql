-- 011_portal_inbox_events.sql
-- Status updates synced from portals (interviews, rejections, views).

CREATE TABLE IF NOT EXISTS portal_inbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    portal VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- interview_invite / rejected / viewed / shortlisted / offer
    job_title VARCHAR(500),
    company VARCHAR(255),
    event_data JSONB,
    read BOOLEAN DEFAULT FALSE,
    occurred_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portal_inbox_events_user_portal ON portal_inbox_events(user_id, portal);
CREATE INDEX idx_portal_inbox_events_read ON portal_inbox_events(read);
