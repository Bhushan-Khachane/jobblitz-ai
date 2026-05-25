# JobBlitz-AI — Migration Plan

> Incremental migration from current 3-plane Python stack to TypeScript-first agentic platform.
> Updated: 2026-05-25

## Guiding Principles

1. **Preserve working code** where possible; refactor rather than rewrite unless rewrite is clearly lower risk
2. **Work incrementally** — after each phase, explain what changed, list files, note risks, suggest next phase
3. **If a weak area is found, propose two options**: preserve-and-refactor vs rewrite-cleanly; prefer lower risk
4. **Do not make destructive changes** until the new service is operational
5. **Commit each phase** as a coherent step
6. **Update docs continuously**

---

## Phase 0 — Repo Assessment ✅

**Status**: Complete

**Deliverables**:
- `/docs/architecture/current-state.md`
- `/docs/architecture/target-state.md`
- `/docs/architecture/migration-plan.md` (this file)
- `/docs/architecture/decision-log.md`
- `/docs/runbooks/local-dev.md`
- `/docs/runbooks/deployment.md`
- `/docs/security/threat-model.md`
- `/docs/prompts/system-prompts.md`
- `/docs/evals/eval-plan.md`

**Files created/moved/deleted**: 9 new doc files in `/docs/`

**Risks/open questions**:
- Can we run Bun alongside Python during migration? Yes, both can coexist in Docker Compose.
- Should we migrate database first or API first? Database schema must be migrated before the new API can use it.
- Should we keep the existing frontend operational during API migration? Yes, the new API will expose compatible endpoints.

**Suggested next phase**: Phase 1 — Monorepo Foundation

---

## Phase 1 — Monorepo Foundation

**Goal**: Set up the target monorepo structure, move code into `apps/` and `packages/`, standardize configs, ensure the repo builds.

**Duration**: 1–2 sessions

### Tasks

1. **Root workspace config**
   - Create root `package.json` with Bun workspaces
   - Define workspaces: `apps/*`, `packages/*`, `tools/*`
   - Add root scripts: `dev`, `build`, `test`, `lint`, `typecheck`

2. **Move existing code**
   - `frontend/` → `apps/web/`
   - `backend/` → `apps/api-legacy/` (temporary)
   - `apps/adk-orchestrator/` → `apps/orchestrator-legacy/` (temporary)
   - `apps/browser-worker/` → `apps/browser-worker-legacy/` (temporary)
   - `apps/browser-extension/` → `apps/browser-extension/` (keep)
   - `packages/` contents → `packages/legacy-*` (temporary)

3. **Create new package skeletons**
   - `packages/types/` — shared Zod schemas and TypeScript types
   - `packages/config/` — shared tsconfig, lint config, env validation
   - `packages/ui/` — shared UI components (move from `apps/web/components/ui`)
   - `packages/db/` — database schema and client (will be populated in Phase 2)
   - `packages/core/` — domain logic placeholder

4. **Standardize TypeScript**
   - Root `tsconfig.json` with `strict: true`
   - Package-level tsconfig extending root
   - No `any` without written justification

5. **Tooling**
   - Biome or ESLint + Prettier for linting/formatting
   - Vitest for testing
   - Husky + lint-staged (optional)
   - `turbo.json` for build pipeline (optional but recommended)

6. **CI skeleton**
   - `.github/workflows/ci.yml` — typecheck, lint, test on PR
   - `.github/workflows/docker.yml` — build images on main

7. **Docker Compose update**
   - Add `apps/api/` (new Hono API) placeholder service
   - Add `apps/worker-orchestrator/` placeholder
   - Add `apps/worker-browser/` placeholder
   - Keep legacy services running
   - Add `pgvector` extension to PostgreSQL

### Files Created
- `/package.json`
- `/tsconfig.json`
- `/turbo.json` (optional)
- `/biome.json` (or ESLint config)
- `/vitest.workspace.ts`
- `packages/types/package.json`
- `packages/config/package.json`
- `packages/ui/package.json`
- `packages/db/package.json`
- `packages/core/package.json`
- `apps/api/package.json`
- `apps/worker-orchestrator/package.json`
- `apps/worker-browser/package.json`
- `apps/mcp-gateway/package.json`
- `.github/workflows/ci.yml`

### Risks
- Moving files breaks git history for blame — acceptable
- Legacy imports may break after moves — fix paths
- Bun workspace compatibility with existing npm packages — test `bun install`

### Definition of Done
- `bun install` succeeds at root
- `bun run build` compiles all packages
- `bun run lint` passes
- `bun run typecheck` passes
- Docker Compose starts all services
- Legacy backend and frontend still run

---

## Phase 2 — Data and Domain Backbone

**Goal**: Design core schema, model domain, add Zod schemas, implement shared DB package.

**Duration**: 2–3 sessions

### Tasks

1. **Database schema design**
   - Create `packages/db/schema.ts` with Drizzle ORM or Prisma
   - Tables: users, profiles, resumes, cover_letters, jobs, job_sources, applications, application_runs, employers, employer_notes, followups, agent_runs, artifacts, approvals, embeddings, credentials, job_searches, question_answers, usage_logs, dead_letter_logs, audit_events, portal_inbox_events
   - Add pgvector extension and embedding columns
   - Add indexes for query paths
   - Add row-level security policies

2. **Migrations**
   - Use Drizzle Kit or Prisma Migrate
   - Create initial migration from existing schema
   - Create migration for new tables
   - Seed script for local dev

3. **Zod schemas**
   - `packages/types/src/schemas.ts` — all DTOs
   - `packages/types/src/api.ts` — API request/response schemas
   - `packages/types/src/events.ts` — queue event payloads
   - Shared with frontend and API

4. **Domain layer**
   - `packages/core/src/domain/` — business rules
   - `packages/core/src/llm/` — model routing abstraction
   - `packages/core/src/scoring/` — match scoring (port from Python)
   - Keep deterministic logic pure and testable

5. **DB access patterns**
   - `packages/db/src/client.ts` — typed client export
   - Transaction helpers for deterministic writes
   - Connection pooling config

### Files Created
- `packages/db/schema.ts`
- `packages/db/src/client.ts`
- `packages/db/drizzle.config.ts` (or `prisma/schema.prisma`)
- `packages/db/migrations/`
- `packages/db/seed.ts`
- `packages/types/src/schemas.ts`
- `packages/types/src/api.ts`
- `packages/types/src/events.ts`
- `packages/types/src/index.ts`
- `packages/core/src/domain/user.ts`
- `packages/core/src/domain/job.ts`
- `packages/core/src/domain/application.ts`
- `packages/core/src/llm/router.ts`
- `packages/core/src/scoring/matcher.ts`

### Risks
- Schema mismatch between Python ORM and new TS ORM — create mapping doc
- Migration failure on existing data — test with copy of production data
- pgvector extension not available in local Postgres — use `ankane/pgvector` image

### Definition of Done
- `bun db:migrate` applies cleanly
- `bun db:seed` populates local database
- Zod schemas validate all known API payloads
- Unit tests for domain logic pass

---

## Phase 3 — Auth, Storage, and Security Base

**Goal**: Implement auth, file storage, encryption, rate limiting, threat model.

**Duration**: 2–3 sessions

### Tasks

1. **Auth (Better Auth)**
   - `packages/auth/src/index.ts` — Better Auth config
   - `apps/api/src/routers/auth.ts` — auth endpoints
   - Session management with secure cookies
   - OAuth providers (Google, LinkedIn)
   - Password hashing (bcrypt)
   - Session rotation

2. **Storage (S3/R2)**
   - `packages/core/src/storage/s3.ts` — generic S3 client
   - Resume upload/download flow
   - Screenshot artifact storage
   - Presigned URL generation
   - Replace Supabase Storage dependency

3. **Security**
   - `packages/security/src/encryption.ts` — AES/Fernet equivalent
   - `packages/security/src/redaction.ts` — PII redaction
   - `packages/security/src/secrets.ts` — secret validation at startup
   - `packages/security/src/rate-limit.ts` — rate limiting middleware
   - CSRF protection
   - Input validation (Zod) on all boundaries
   - Secure headers middleware

4. **Threat model**
   - `/docs/security/threat-model.md` — STRIDE analysis
   - Security checklist
   - Vulnerability remediation plan

### Files Created
- `packages/auth/src/index.ts`
- `packages/auth/src/middleware.ts`
- `packages/core/src/storage/s3.ts`
- `packages/security/src/encryption.ts`
- `packages/security/src/redaction.ts`
- `packages/security/src/secrets.ts`
- `packages/security/src/rate-limit.ts`
- `apps/api/src/middleware/security.ts`
- `apps/api/src/middleware/validation.ts`
- `docs/security/threat-model.md`

### Risks
- Better Auth migration breaks existing Supabase sessions — dual-auth period
- S3 credentials need rotation — add to `.env.example`
- Encryption key migration — document key derivation

### Definition of Done
- Login/logout works end-to-end
- Resume upload/download works
- Rate limiting blocks excessive requests
- Security headers present on all responses
- Threat model reviewed

---

## Phase 4 — Frontend Platform

**Goal**: Build production-grade Next.js 15 app with all major screens.

**Duration**: 3–4 sessions

### Tasks

1. **Next.js 15 upgrade**
   - Upgrade `apps/web` to Next.js 15
   - Update React to 19 (or compatible 18)
   - Update Tailwind to v4 (or keep v3)
   - Fix breaking changes

2. **Shared UI**
   - Move shadcn/ui components to `packages/ui`
   - Add new components: DataTable, FormBuilder, ApprovalCard, Timeline, ResearchPanel
   - Theme system (light/dark)

3. **Major screens**
   - `/dashboard` — Overview, stats, quick actions
   - `/profile` — User profile editor
   - `/jobs` — Jobs feed with filters, scoring, search
   - `/applications` — Applications pipeline (Kanban/list)
   - `/research` — Company intelligence panel
   - `/approvals` — Approval queue with actions
   - `/settings` — Account, billing, preferences
   - `/login`, `/register`, `/onboarding`

4. **States**
   - Loading skeletons
   - Empty states
   - Error boundaries
   - Optimistic updates

5. **API client**
   - tRPC router in `apps/api`
   - tRPC client in `apps/web`
   - Type-safe data fetching
   - React Query (or tRPC's useQuery)

### Files Created
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/profile/page.tsx`
- `apps/web/app/jobs/page.tsx`
- `apps/web/app/applications/page.tsx`
- `apps/web/app/research/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/settings/page.tsx`
- `packages/ui/src/components/data-table.tsx`
- `packages/ui/src/components/approval-card.tsx`
- `packages/ui/src/components/timeline.tsx`
- `packages/ui/src/components/research-panel.tsx`
- `apps/web/lib/trpc.ts`
- `apps/api/src/routers/trpc.ts`

### Risks
- Next.js 15 breaking changes — test thoroughly
- tRPC learning curve — start simple
- UI polish takes time — use shadcn/ui defaults

### Definition of Done
- All major screens render without errors
- Navigation works
- tRPC queries return typed data
- Responsive on mobile and desktop

---

## Phase 5 — API Platform

**Goal**: Build Hono API on Bun with all major routes.

**Duration**: 3–4 sessions

### Tasks

1. **Hono app setup**
   - `apps/api/src/index.ts` — Hono app factory
   - `apps/api/src/middleware/` — auth, logging, CORS, rate limit
   - `apps/api/src/routers/` — route modules

2. **Routes**
   - `auth.ts` — Better Auth integration
   - `profile.ts` — User profile CRUD
   - `jobs.ts` — Job ingestion, search, filter
   - `resumes.ts` — Upload, parse, manage
   - `scoring.ts` — Match scoring
   - `applications.ts` — Application lifecycle
   - `approvals.ts` — Approval queue
   - `followups.ts` — Follow-up management
   - `research.ts` — Company/role intelligence
   - `health.ts` — Health and readiness
   - `observability.ts` — Metrics endpoint

3. **Strong typing**
   - Zod validation on every request/response
   - tRPC router for frontend
   - OpenAPI spec generation (optional)
   - Idempotency middleware

4. **Background job enqueueing**
   - Integrate BullMQ in API routes
   - Enqueue discovery, scoring, application jobs

### Files Created
- `apps/api/src/index.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/middleware/logger.ts`
- `apps/api/src/middleware/rate-limit.ts`
- `apps/api/src/middleware/idempotency.ts`
- `apps/api/src/routers/auth.ts`
- `apps/api/src/routers/profile.ts`
- `apps/api/src/routers/jobs.ts`
- `apps/api/src/routers/resumes.ts`
- `apps/api/src/routers/scoring.ts`
- `apps/api/src/routers/applications.ts`
- `apps/api/src/routers/approvals.ts`
- `apps/api/src/routers/followups.ts`
- `apps/api/src/routers/research.ts`
- `apps/api/src/routers/health.ts`

### Risks
- Hono + Bun compatibility edge cases — test on macOS and Linux
- tRPC with Hono — use `@trpc/server` adapters
- Performance regression vs FastAPI — benchmark

### Definition of Done
- All routes respond correctly to curl requests
- tRPC client works from frontend
- Auth middleware protects private routes
- Rate limiting active
- Health endpoint passes

---

## Phase 6 — Research Layer

**Goal**: Create Perplexity Sonar integration for employer and role research.

**Duration**: 1–2 sessions

### Tasks

1. **Perplexity client**
   - `packages/research/src/sonar.ts` — HTTP client with retries
   - `packages/research/src/types.ts` — Sonar response types
   - Citation tracking

2. **Enrichment pipelines**
   - `packages/research/src/employer.ts` — Company enrichment
   - `packages/research/src/role.ts` — Role requirement extraction
   - `packages/research/src/reputation.ts` — Reputation snapshot

3. **Storage**
   - Store research artifacts in `employers` table
   - Citations in JSONB
   - Timestamps for freshness

4. **API routes**
   - `POST /api/v1/research/employer` — Trigger enrichment
   - `GET /api/v1/research/employer/:id` — Get cached results

### Files Created
- `packages/research/src/sonar.ts`
- `packages/research/src/employer.ts`
- `packages/research/src/role.ts`
- `packages/research/src/reputation.ts`
- `packages/research/src/types.ts`
- `apps/api/src/routers/research.ts`

### Risks
- Perplexity API rate limits — implement caching and backoff
- Cost — monitor usage
- Data freshness — implement TTL

### Definition of Done
- Research endpoint returns structured data with citations
- Results cached in database
- Frontend research panel displays data

---

## Phase 7 — Browser Automation Layer

**Goal**: Build Stagehand-based browser worker with Playwright fallback.

**Duration**: 2–3 sessions

### Tasks

1. **Stagehand worker**
   - `apps/worker-browser/src/index.ts` — Bun server
   - `apps/worker-browser/src/stagehand.ts` — Stagehand wrapper
   - `apps/worker-browser/src/session.ts` — Session management
   - `apps/worker-browser/src/artifacts.ts` — Screenshot, DOM snapshot, trace persistence

2. **Primitives**
   - `observe`, `extract`, `act` endpoints
   - `agent` endpoint for bounded subtasks
   - Playwright fallback endpoints for known ATS

3. **ATS adapters**
   - Port Python ATS adapters to TypeScript
   - `packages/browser/src/ats/greenhouse.ts`
   - `packages/browser/src/ats/lever.ts`
   - `packages/browser/src/ats/ashby.ts`
   - `packages/browser/src/ats/workday.ts`

4. **Failure classification**
   - `packages/browser/src/failure.ts` — Classify errors
   - Escalation paths

5. **MCP browser server**
   - `mcp/browser/src/server.ts` — MCP server exposing browser tools

### Files Created
- `apps/worker-browser/src/index.ts`
- `apps/worker-browser/src/stagehand.ts`
- `apps/worker-browser/src/session.ts`
- `apps/worker-browser/src/artifacts.ts`
- `packages/browser/src/ats/greenhouse.ts`
- `packages/browser/src/ats/lever.ts`
- `packages/browser/src/ats/ashby.ts`
- `packages/browser/src/ats/workday.ts`
- `packages/browser/src/failure.ts`
- `mcp/browser/src/server.ts`

### Risks
- Stagehand is newer than Playwright — edge cases
- Browserbase integration complexity — start with local Stagehand
- Selector drift — maintain fallback selectors

### Definition of Done
- Browser worker starts and responds to health
- Stagehand primitives work on test pages
- Playwright fallback works on known ATS demo pages
- Screenshots and traces persisted to storage

---

## Phase 8 — LangGraph Orchestration

**Goal**: Build durable workflows in LangGraph.

**Duration**: 3–4 sessions

### Tasks

1. **LangGraph setup**
   - `packages/agents/src/graph/` — workflow definitions
   - `packages/agents/src/nodes/` — graph nodes
   - `packages/agents/src/state/` — state types
   - `packages/agents/src/checkpoint/` — PostgresSaver config

2. **Workflows**
   - `ingestionGraph` — Job ingest and normalize
   - `scoringGraph` — Match scoring
   - `researchGraph` — Research enrichment
   - `tailoringGraph` — Resume tailoring
   - `applicationGraph` — Application execution
   - `followupGraph` — Follow-up scheduling
   - `staleReviewGraph` — Stale application review

3. **Human-in-the-loop**
   - `interrupt` nodes at approval gates
   - `ApprovalRequest` table integration
   - Resume graph after approval

4. **Checkpointing**
   - PostgresSaver for durable state
   - Resume after restart
   - Inspect run state

5. **Worker**
   - `apps/worker-orchestrator/src/index.ts` — BullMQ consumer
   - Map queue jobs to graph invocations

### Files Created
- `packages/agents/src/graph/ingestion.ts`
- `packages/agents/src/graph/scoring.ts`
- `packages/agents/src/graph/research.ts`
- `packages/agents/src/graph/tailoring.ts`
- `packages/agents/src/graph/application.ts`
- `packages/agents/src/graph/followup.ts`
- `packages/agents/src/graph/stale-review.ts`
- `packages/agents/src/nodes/discover.ts`
- `packages/agents/src/nodes/screen.ts`
- `packages/agents/src/nodes/plan.ts`
- `packages/agents/src/nodes/apply.ts`
- `packages/agents/src/nodes/verify.ts`
- `packages/agents/src/state/types.ts`
- `packages/agents/src/checkpoint/postgres.ts`
- `apps/worker-orchestrator/src/index.ts`
- `apps/worker-orchestrator/src/worker.ts`

### Risks
- LangGraph learning curve — start with simple linear graphs
- Checkpointing performance — benchmark Postgres writes
- Human-in-the-loop UX — design approval flows carefully

### Definition of Done
- At least 3 workflows run end-to-end
- Workflows resume after worker restart
- Approval gates pause and resume correctly
- State inspectable via API

---

## Phase 9 — Memory and Retrieval

**Goal**: Implement operational memory using Postgres + pgvector.

**Duration**: 2 sessions

### Tasks

1. **Embedding generation**
   - `packages/memory/src/embeddings.ts` — OpenAI/Anthropic embedding client
   - Batch embedding jobs
   - Store in `embeddings` table with pgvector

2. **Retrieval**
   - `packages/memory/src/retrieve.ts` — Semantic search
   - `packages/memory/src/filter.ts` — Structured filters
   - Hybrid search (vector + keyword)

3. **Summarization**
   - `packages/memory/src/summarize.ts` — Compress old agent runs
   - Background job via BullMQ

4. **Profile memory**
   - `packages/memory/src/profile.ts` — User preference storage
   - `packages/memory/src/employer.ts` — Employer interaction history

### Files Created
- `packages/memory/src/embeddings.ts`
- `packages/memory/src/retrieve.ts`
- `packages/memory/src/filter.ts`
- `packages/memory/src/summarize.ts`
- `packages/memory/src/profile.ts`
- `packages/memory/src/employer.ts`

### Risks
- Embedding model choice affects quality — default to OpenAI text-embedding-3-small
- pgvector performance at scale — add indexes early
- Summarization cost — batch and rate-limit

### Definition of Done
- Embeddings generated for jobs and profiles
- Semantic search returns relevant results
- Summarization jobs run without errors

---

## Phase 10 — MCP-Native Internal Tools

**Goal**: Expose internal capabilities as MCP tools/services.

**Duration**: 2 sessions

### Tasks

1. **MCP Gateway**
   - `apps/mcp-gateway/src/index.ts` — MCP server gateway
   - Tool registration and routing
   - Authentication

2. **MCP Servers**
   - `mcp/postgres/src/server.ts` — DB query tools
   - `mcp/files/src/server.ts` — File read/write tools
   - `mcp/browser/src/server.ts` — Browser control tools
   - `mcp/email/src/server.ts` — Email tools
   - `mcp/calendar/src/server.ts` — Calendar tools
   - `mcp/research/src/server.ts` — Research tools

3. **Contracts**
   - Zod schemas for all tool inputs/outputs
   - Documentation for Claude Code integration
   - Audit logging

### Files Created
- `apps/mcp-gateway/src/index.ts`
- `apps/mcp-gateway/src/registry.ts`
- `mcp/postgres/src/server.ts`
- `mcp/files/src/server.ts`
- `mcp/browser/src/server.ts`
- `mcp/email/src/server.ts`
- `mcp/calendar/src/server.ts`
- `mcp/research/src/server.ts`

### Risks
- MCP spec changes — pin to stable version
- Tool security — validate all inputs, audit usage
- Performance — MCP adds latency

### Definition of Done
- MCP servers start independently
- Tools callable via MCP protocol
- Audit logs capture tool usage
- Documentation for connecting Claude Code

---

## Phase 11 — Multi-Agent Specialization

**Goal**: Implement role-specialized agents on top of working workflows.

**Duration**: 2 sessions

### Tasks

1. **Agents**
   - `packages/agents/src/agents/discovery.ts` — DiscoveryAgent
   - `packages/agents/src/agents/match.ts` — MatchAgent
   - `packages/agents/src/agents/resume.ts` — ResumeAgent
   - `packages/agents/src/agents/apply.ts` — ApplyAgent
   - `packages/agents/src/agents/followup.ts` — FollowUpAgent
   - `packages/agents/src/agents/research.ts` — ResearchAgent

2. **Supervisor**
   - `packages/agents/src/supervisor.ts` — Router layer
   - Delegation logic
   - Graceful degradation

3. **Shared memory**
   - All agents use `packages/memory`
   - All agents use `packages/core` domain logic
   - No duplicate business logic

### Files Created
- `packages/agents/src/agents/discovery.ts`
- `packages/agents/src/agents/match.ts`
- `packages/agents/src/agents/resume.ts`
- `packages/agents/src/agents/apply.ts`
- `packages/agents/src/agents/followup.ts`
- `packages/agents/src/agents/research.ts`
- `packages/agents/src/supervisor.ts`

### Risks
- Over-engineering — keep agents narrow
- Conflicting agent actions — supervisor must resolve

### Definition of Done
- Each agent handles its scope independently
- Supervisor routes requests correctly
- Agents degrade gracefully on low confidence

---

## Phase 12 — Evals, Observability, and Hardening

**Goal**: Add telemetry, evals, dashboards, and hardening.

**Duration**: 2–3 sessions

### Tasks

1. **OpenTelemetry**
   - `packages/observability/src/tracing.ts` — Tracer setup
   - Instrument API, workers, browser runs
   - Request ID propagation

2. **Langfuse**
   - `packages/observability/src/langfuse.ts` — Langfuse client
   - Prompt tracking
   - Tool call instrumentation
   - Outcome logging

3. **Sentry**
   - Error tracking in API and workers
   - Source maps for frontend

4. **Structured logs**
   - `packages/observability/src/logger.ts` — Pino logger
   - JSON output
   - PII redaction

5. **Evals**
   - `tools/evals/job-extraction.ts` — Job extraction quality
   - `tools/evals/match-scoring.ts` — Scoring consistency
   - `tools/evals/resume-tailoring.ts` — Tailoring quality
   - `tools/evals/application-success.ts` — Success rate
   - `tools/evals/failure-classification.ts` — Failure accuracy
   - `tools/evals/approval-decision.ts` — Decision quality

6. **Health and dashboards**
   - Health endpoints for all services
   - Metrics endpoint for Prometheus (optional)
   - Load and retry testing

7. **Hardening checklist**
   - `docs/security/hardening-checklist.md`
   - Launch-readiness report

### Files Created
- `packages/observability/src/tracing.ts`
- `packages/observability/src/langfuse.ts`
- `packages/observability/src/logger.ts`
- `packages/observability/src/sentry.ts`
- `tools/evals/job-extraction.ts`
- `tools/evals/match-scoring.ts`
- `tools/evals/resume-tailoring.ts`
- `tools/evals/application-success.ts`
- `tools/evals/failure-classification.ts`
- `tools/evals/approval-decision.ts`
- `docs/security/hardening-checklist.md`

### Risks
- Evals take time to design — start simple
- Observability overhead — benchmark
- Sentry noise — configure sampling

### Definition of Done
- Traces visible in Langfuse/Sentry
- Eval suite runs and produces scores
- Load test passes
- Hardening checklist complete

---

## Final Definition of Done

The migration is complete when:

1. ✅ Repo organized into target structure (or justified close variant)
2. ✅ App runs locally (`bun dev` or Docker Compose)
3. ✅ API, browser worker, and orchestrator worker run independently
4. ✅ At least one realistic end-to-end job application flow works in a supervised path
5. ✅ Research enrichment works with provenance
6. ✅ LangGraph workflows are durable and resumable
7. ✅ MCP tools scaffolded or implemented for core system capabilities
8. ✅ Observability and eval basics are in place
9. ✅ Docs sufficient for another engineer to continue confidently

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready, stable |
| `develop` | Integration branch for migration work |
| `phase/1-monorepo` | Phase 1 work |
| `phase/2-data` | Phase 2 work |
| `phase/3-auth` | Phase 3 work |
| ... | ... |
| `feature/*` | Individual features within phases |

**Recommendation**: Use `develop` as the integration branch. Merge each phase branch into `develop` when complete. Merge `develop` into `main` only at major milestones.

## Rollback Plan

- Keep legacy services (`apps/api-legacy`, `apps/orchestrator-legacy`, `apps/browser-worker-legacy`) operational until the new services pass parity tests.
- Database migrations are forward-compatible (new columns nullable, new tables independent).
- Feature flags (`packages/config/src/flags.ts`) allow disabling new services.
- Rollback to legacy: revert Docker Compose service names, keep DB schema additive-only.
