# JobBlitz-AI — Current State Architecture

> Phase 0 audit completed 2026-05-25.

## 1. Repository Layout

```
jobblitz-ai/
├── backend/               # FastAPI + SQLAlchemy async + ARQ
│   ├── app/
│   │   ├── routers/       # 17 FastAPI router modules
│   │   ├── services/      # 40+ service modules
│   │   ├── models.py      # SQLAlchemy ORM (20 tables)
│   │   ├── schemas.py     # Pydantic schemas
│   │   ├── main.py        # App factory, health, lifespan
│   │   ├── config.py      # Pydantic-settings
│   │   ├── middleware.py  # Request logging
│   │   ├── database.py    # Async engine + session
│   │   ├── redis_client.py
│   │   └── telemetry.py   # OpenTelemetry setup
│   ├── alembic/           # DB migrations
│   ├── tests/             # pytest suite
│   ├── scripts/           # Smoke tests
│   ├── Dockerfile
│   ├── requirements.txt   # 29 Python deps
│   └── arq_worker.py      # ARQ worker settings
├── frontend/              # Next.js 14 + TypeScript + Tailwind
│   ├── app/               # App router pages
│   ├── components/        # shadcn/ui + custom
│   ├── hooks/             # React hooks (Supabase realtime)
│   ├── lib/               # utils
│   ├── package.json       # npm deps
│   └── Dockerfile
├── apps/
│   ├── adk-orchestrator/  # FastAPI "Intelligence Plane"
│   │   ├── agents/        # 7 Python agents (coordinator, discovery, screening, planner, apply, verification, status_sync, cover_letter)
│   │   ├── tools/         # browser_tools.py, job_apis.py
│   │   ├── config/        # llm.py, gemini.py
│   │   ├── state/         # run_tracker.py (Redis-backed)
│   │   ├── main.py        # FastAPI endpoints
│   │   ├── scheduler.py   # APScheduler cron
│   │   └── requirements.txt
│   ├── browser-worker/    # FastAPI "Execution Plane"
│   │   ├── browser.py     # Playwright primitives
│   │   ├── session_manager.py
│   │   ├── main.py        # HTTP wrapper for browser actions
│   │   └── requirements.txt
│   └── browser-extension/ # Chrome extension (content + background scripts)
├── packages/
│   ├── portal_naukri/     # Naukri selectors
│   ├── scoring/           # Fit scorer module
│   └── shared/            # enums.py, types.py
├── infra/
│   └── docker/
│       └── docker-compose.yml
├── docs/                  # Existing docs (architecture, setup)
├── scripts/               # startup scripts
└── docker-compose.yml     # Full stack: postgres, redis, backend, frontend, adk-orchestrator, browser-worker, arq_worker
```

## 2. Tech Stack

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| Frontend | Next.js | 14.2.21 (App Router) |
| Frontend | React | 18.3.1 |
| Frontend | Tailwind CSS | 3.4.17 |
| Frontend | shadcn/ui | Radix primitives |
| Frontend | State | React hooks, Supabase realtime |
| Backend API | FastAPI | 0.115.6 |
| Backend ORM | SQLAlchemy | 2.0.36 (async) |
| Backend DB driver | asyncpg | 0.30.0 |
| Backend Queue | ARQ | 0.25.0 (Redis-based) |
| Backend Auth | python-jose + bcrypt | Custom JWT |
| Backend Browser | Playwright | 1.49.1 + playwright-stealth |
| Backend AI | google-generativeai | 0.8.3 |
| Backend AI | openai | 1.58.1 |
| Orchestrator | FastAPI + custom agents | Python |
| Orchestrator AI | Gemini + OpenAI + Ollama | Multi-provider |
| Browser Worker | FastAPI + Playwright | Python |
| Database | PostgreSQL | 15 |
| Cache / Queue | Redis | 7 |
| Object Storage | Supabase Storage | S3-compatible |
| Telemetry | OpenTelemetry | FastAPI + SQLAlchemy instrumentation |
| Container | Docker + Docker Compose | Local dev |
| Package Manager | pip (backend), npm (frontend) | No monorepo workspace |

## 3. Data Model (20 Tables)

**Core domain**: `users`, `profiles`, `credentials`, `resumes`, `job_searches`, `job_listings`, `applications`

**3-Plane architecture additions**: `job_search_profiles`, `job_leads`, `job_scores`, `job_recommendations`, `application_plans`, `application_runs`, `application_step_events`, `agent_runs`, `approval_requests`, `portal_inbox_events`, `audit_events`

**Infrastructure**: `usage_logs`, `dead_letter_logs`, `login_sessions`, `user_portal_accounts`, `browser_sessions`, `question_answers`

### Strengths
- Comprehensive domain coverage (users, profiles, jobs, applications, approvals, audit)
- Proper indexing on hot query paths (`user_id + status`, `platform + external_job_id`)
- JSONB columns for flexible schema evolution
- Audit trail tables (`audit_events`, `application_step_events`)
- Idempotency keys on `applications`

### Gaps
- No `pgvector` extension or embedding storage
- No `employers` table (only `company` string on listings)
- No `followups` table
- No `cover_letters` standalone table (only field on `applications`)
- No structured `artifacts` table for screenshots, resumes, traces
- No `events` pub/sub contract

## 4. Services Inventory (Backend)

| Service | Purpose | Preserve? | Risk |
|---------|---------|-----------|------|
| `ai_service.py` | LLM abstraction, prompt templates | **Extract prompts** | Hardcoded provider logic |
| `apply_service.py` | Application execution via browser | **Preserve logic** | Deep Playwright coupling |
| `ats_adapters.py` | Greenhouse, Lever, Workday, SmartRecruit adapters | **Preserve** | Selector drift risk |
| `ats_router.py` | Route URLs to correct ATS adapter | **Preserve** | — |
| `browser_pool.py` | Manage Playwright browser instances | **Replace** | Needs isolation + Stagehand |
| `circuit_breaker.py` | Failure detection | **Preserve pattern** | — |
| `cover_letter_service.py` | Generate cover letters | **Preserve logic** | Hardcoded Gemini |
| `job_discovery/` | Scrapers for 7 portals | **Preserve** | Heavy maintenance |
| `llm_client.py` | Multi-provider LLM client | **Preserve abstraction** | Needs TypeScript port |
| `match_scorer.py` | Fit scoring | **Preserve algorithm** | — |
| `matcher.py` | Token-overlap fallback matcher | **Preserve** | — |
| `pdf_service.py` | Resume parsing | **Preserve** | — |
| `platforms/` | Portal-specific apply flows | **Preserve** | Deep selectors |
| `profile_parser.py` | Extract profile from resume | **Preserve** | — |
| `proxy_service.py` | Proxy rotation | **Preserve** | — |
| `scraper_browser.py` | Browser-based scraping | **Preserve** | — |
| `scraper_service.py` | Orchestrate scraping | **Preserve** | — |
| `storage.py` | Supabase S3 upload/download | **Preserve abstraction** | Needs S3/R2 generalization |
| `velocity_governor.py` | Rate limiting | **Preserve** | — |

## 5. Orchestrator (ADK) Agents

| Agent | Language | Model | Durability | Notes |
|-------|----------|-------|------------|-------|
| `coordinator` | Python | Gemini 2.0 Flash | Redis state only | No true workflow checkpointing |
| `discovery_agent` | Python | Gemini 2.0 Flash | — | Uses public APIs + browser |
| `screening_agent` | Python | Gemini 2.5 Pro | — | LLM-only scoring |
| `planner_agent` | Python | Gemini 2.0 Flash | — | Reads form structure |
| `apply_agent` | Python | Gemini 2.0 Flash | — | Step-by-step execution |
| `verification_agent` | Python | Gemini 2.0 Flash | — | Screenshot + diff |
| `status_sync_agent` | Python | Gemini 2.0 Flash | — | Daily inbox sync |
| `cover_letter_agent` | Python | Gemini 2.5 Pro | — | Cover letter generation |

### Strengths
- Multi-agent workflow already designed (discovery → screening → planner → apply → verification)
- Human-in-the-loop via `approval_requests`
- Agent runs tracked in `agent_runs` table
- Step events in `application_step_events`

### Gaps
- **No true workflow engine** — coordinator is imperative Python, not a graph
- **No checkpoint/resume** — Redis state is ephemeral
- **No LangGraph** — custom agent dispatch
- **No MCP tools** — browser_tools.py is ad-hoc HTTP calls
- **LangChain/LangGraph not used**
- **No eval framework**

## 6. Browser Automation

| Component | Technology | Notes |
|-----------|-----------|-------|
| Browser Worker | Playwright + stealth | HTTP API wrapper |
| Backend Browser Pool | Playwright | Direct integration in backend |
| Neko | Dockerized Chromium | Cloud browser for manual login |
| Session Storage | Cookie JSON files | Per-user, per-portal |

### Strengths
- Playwright + stealth already working
- Session isolation per user per portal
- Screenshot capture on failure
- Cookie import/export flow

### Gaps
- **No Stagehand** — raw Playwright only
- **No observe/extract/act primitives** — imperative selectors
- **No DOM snapshots** for debugging
- **No anti-bot detection classification**
- **No replayability** beyond screenshots
- **Browser Worker and Backend Browser Pool are duplicated**

## 7. Frontend

### Pages
- `/` — Landing
- `/login` — Auth
- `/register` — Registration
- `/onboarding` — Profile setup
- `/settings` — Settings
- `/(dashboard)/` — Main dashboard (with sidebar)
- `/portals/` — Portal connections
- `/portals/connect/[portal]` — Manual login
- `/discovery/` — Job discovery
- `/review-jobs/` — Job review/approval
- `/applications/[id]/timeline/` — Application timeline
- `/settings/job-profile/` — Job profile

### Strengths
- shadcn/ui components already installed
- TypeScript + Tailwind
- Supabase auth integration
- Responsive layout with sidebar

### Gaps
- **Next.js 14** → needs upgrade to 15
- **No package workspace** — isolated frontend
- **Missing screens**: Research/Company Intelligence, Approvals queue, Follow-ups, Analytics
- **No shared types** with backend (Pydantic ↔ Zod mismatch)
- **No tRPC or typed API client**

## 8. Deployment & Infrastructure

- Docker Compose for local dev (7 services)
- No Kubernetes manifests
- No Terraform
- No CI/CD workflows (only actionlint config in .gstack)
- No staging/prod environment split
- Neko browser container custom Dockerfile

## 9. Security Posture

### Strengths
- Credentials encrypted with Fernet
- No passwords stored for portals (cookie-based)
- JWT auth with refresh tokens
- CORS configured
- TrustedHostMiddleware
- Request logging middleware
- Audit events table
- Application step events for traceability

### Gaps
- **No threat model document**
- **No PII redaction** in logs
- **No secrets validation** at startup (some keys optional with empty defaults)
- **No rate limiting** on public endpoints (only application velocity governor)
- **No CSRF tokens**
- **No input sanitization** against prompt injection
- **Internal API key** shared across services via env var
- **No mTLS** between services
- **No Sentry** error tracking
- **No structured logging** (only request logs)

## 10. Observability

- OpenTelemetry FastAPI + SQLAlchemy instrumentation
- Health check endpoints on all services
- Application step events table
- Agent runs table
- Dead letter logs

### Gaps
- **No Langfuse** for prompt/LLM tracing
- **No structured logs** (JSON)
- **No metrics dashboard**
- **No alerting**
- **No Sentry**
- **No distributed tracing** between backend ↔ orchestrator ↔ browser worker

## 11. Test Coverage

- pytest in backend/tests/
- Playwright E2E in frontend/e2e/
- Smoke test script

### Gaps
- **No eval framework** for AI quality
- **No load tests**
- **No contract tests** between services
- **No fixture-based tests** for domain logic

## 12. Summary: Keep vs Migrate

| Asset | Decision | Rationale |
|-------|----------|-----------|
| FastAPI backend | **Migrate to Hono/Bun** | Target architecture requires TypeScript API |
| SQLAlchemy models | **Migrate to Drizzle/Prisma + Zod** | TypeScript stack |
| ARQ workers | **Migrate to BullMQ** | Target specifies Redis + BullMQ |
| Playwright browser | **Wrap with Stagehand** | Target specifies Stagehand + Browserbase |
| ADK orchestrator | **Rewrite in LangGraph** | No migration path from custom Python |
| Frontend Next.js 14 | **Upgrade to 15 + refactor** | Incremental upgrade |
| shadcn/ui components | **Keep** | Already aligned with target |
| Tailwind config | **Keep** | Already aligned |
| Database schema | **Preserve + extend** | Add pgvector, employers, followups, artifacts |
| Job discovery scrapers | **Preserve** | Heavy maintenance, rewrite later |
| ATS adapters | **Preserve** | Rewrite later |
| AI prompts | **Extract + version** | Move to packages/agents/prompts/ |
| Docker Compose | **Rewrite** | New service topology |
| Auth (custom JWT) | **Migrate to Better Auth** | Target specifies Better Auth |
| Supabase Storage | **Generalize to S3/R2** | Target specifies S3/R2-compatible |

## 13. Migration Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Full Python→TS rewrite breaks existing features | High | High | Phase-by-phase migration; keep Python running until TS service passes parity tests |
| Database migration errors | Medium | High | Alembic migrations + seed scripts + backup strategy |
| Selector drift during migration | Medium | Medium | Freeze scraper logic; port verbatim first |
| Auth migration breaks sessions | Medium | High | Dual-auth period; migrate users gradually |
| LLM provider changes affect quality | Medium | Medium | Preserve multi-provider abstraction |
| Browser automation reliability drops | Medium | High | Keep Playwright fallback; add Stagehand incrementally |
| LangGraph learning curve delays | Medium | Medium | Start with simple graphs; iterate |
| Frontend rewrite loses UX polish | Low | Medium | Keep shadcn/ui; add screens incrementally |
| pgvector extension issues | Low | Medium | Test locally before prod |
| Team ramp-up on new stack | Medium | Medium | Docs + runbooks + typed APIs |
