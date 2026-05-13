# JobBlitz Folder Structure

```
jobblitz-ai/
├── backend/                          ← existing Control Plane API
│   ├── app/
│   │   ├── routers/                  ← NEW: portal_sessions, discovery, scoring, application_plans, status_sync
│   │   ├── models.py                 ← NEW models appended (12 tables)
│   │   ├── schemas.py                ← NEW schemas appended
│   │   └── main.py                   ← NEW routers registered
│   ├── alembic/versions/             ← NEW: 013_new_arch_tables.py
│   └── ...
├── frontend/                         ← existing Control Plane UI
│   ├── app/(dashboard)/
│   │   ├── portals/page.tsx           ← NEW
│   │   ├── portals/connect/[portal]/page.tsx  ← NEW
│   │   ├── discovery/page.tsx         ← NEW
│   │   ├── review-jobs/page.tsx       ← NEW
│   │   ├── applications/[id]/timeline/page.tsx  ← NEW
│   │   └── settings/job-profile/page.tsx  ← NEW
│   └── components/dashboard/Sidebar.tsx  ← UPDATED nav items
├── apps/
│   ├── adk-orchestrator/             ← NEW Intelligence Plane
│   │   ├── agents/
│   │   │   ├── discovery_agent.py
│   │   │   ├── screening_agent.py
│   │   │   ├── planner_agent.py
│   │   │   ├── apply_agent.py
│   │   │   ├── verification_agent.py
│   │   │   ├── status_sync_agent.py
│   │   │   └── coordinator.py
│   │   ├── tools/
│   │   │   └── browser_tools.py
│   │   ├── config/
│   │   │   └── gemini.py
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── browser-worker/               ← NEW Execution Plane
│       ├── browser.py
│       ├── session_manager.py
│       ├── config.py
│       ├── setup.sh
│       ├── main.py
│       ├── requirements.txt
│       └── Dockerfile
├── packages/
│   ├── shared/                       ← NEW: types, events, enums
│   │   ├── enums.py
│   │   └── types.py
│   ├── scoring/                      ← NEW: fit scorer, JD extractor
│   │   └── fit_scorer.py
│   └── portal-naukri/                ← NEW: Naukri selectors
│       └── selectors.py
├── infra/
│   ├── docker/
│   │   └── docker-compose.yml        ← UPDATED: adds adk + browser services
│   └── sql/
│       ├── 001_user_portal_accounts.sql
│       ├── 002_browser_sessions.sql
│       ├── 003_job_search_profiles.sql
│       ├── 004_job_leads.sql
│       ├── 005_job_scores.sql
│       ├── 006_application_plans.sql
│       ├── 007_application_runs.sql
│       ├── 008_application_step_events.sql
│       ├── 009_agent_runs.sql
│       ├── 010_approval_requests.sql
│       ├── 011_portal_inbox_events.sql
│       └── 012_audit_events.sql
├── docs/
│   ├── SETUP_GOOGLE_AI_STUDIO.md
│   ├── SETUP_GSTACK.md
│   ├── jobblitzz-architecture.md
│   └── folder-structure.md
├── .env.example                      ← UPDATED: add Gemini keys
└── .gitignore                        ← UPDATED: add gstack, sessions
```
