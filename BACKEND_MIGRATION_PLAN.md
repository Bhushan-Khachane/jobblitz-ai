# JobBlitz-AI Backend Migration Plan

**Date:** 2026-05-29  
**Goal:** Integrate assisted_apply backend architecture and concepts into JobBlitz-AI as an internal engine, while preserving JobBlitz-AI as the product-facing app.

---

## 1. Current State

### Stack
- **Monorepo:** Bun + Turborepo, TypeScript 5.8 (strict)
- **API:** Hono (apps/api) on port 8000
- **Frontend:** Next.js 15 (apps/web) on port 3000
- **DB:** PostgreSQL 16 + pgvector, Drizzle ORM (packages/db)
- **Cache/Queue:** Redis, BullMQ (apps/api/src/queue.ts + apps/worker-orchestrator)
- **Auth:** Better Auth (packages/auth)
- **AI:** LangGraph (@langchain/langgraph) + custom lightweight StateGraph (packages/agents)
- **Observability:** OpenTelemetry, Langfuse, Sentry
- **Browser:** Playwright + Stagehand (packages/browser + apps/worker-browser)
- **Legacy:** FastAPI/Python API (apps/api-legacy) still active

### What Already Works
- Jobs CRUD, semantic search (pgvector), hybrid search
- Applications with statuses: pending, approved, submitted, failed, interview, rejected, accepted, withdrawn, skipped
- LangGraph application workflow: detect ATS → approval gate → browser apply → retry → notify
- BullMQ worker orchestrator (concurrency 3) on `orchestration-jobs`
- Resume upload, parsing, tailoring (rule-based skill overlap)
- Cover letter generation
- Employer/role research via Perplexity
- Dashboard SSE, approvals queue, ops metrics
- Vector embeddings (1536-dim OpenAI) with HNSW

### Gaps vs assisted_apply
1. **No BaseAgent pattern** — agents are ad-hoc; no unified cost tracking, fallback, or latency logging per agent call.
2. **No Compliance layer** — outbound messaging lacks regulatory safety checks.
3. **No Coach Handoff queue** — only `approvals` (human-in-the-loop for auto-apply); no dedicated coach review system.
4. **No Cost Tracking service** — Langfuse traces exist, but no per-operation cost abstraction or burn dashboard.
5. **No Cache Service abstraction** — Redis used directly; no structured TTL wrapper.
6. **No Queue Dashboard** — Bull Board not exposed.
7. **No Daily Job Hunt worker** — `jobSearches` exist but no scheduled periodic discovery.
8. **No Compliance Filter worker** — no queued compliance checks.
9. **Limited agent specialization** — only 6 coarse agents vs 13 specialized agents.
10. **No explicit Application Service** — status transitions are inline in routers/workers.

---

## 2. Desired State

### Architecture Boundaries
```
app/API layer        → apps/api/src/ (Hono routes, middleware, auth)
orchestration layer  → apps/worker-orchestrator/src/ (BullMQ workers, schedules)
domain services      → packages/core/src/ (scoring, compliance, cost, cache)
AI agents            → packages/agents/src/ (specialized agents + BaseAgent)
infra adapters       → packages/db, packages/memory, packages/browser
product logic        → apps/api/src/modules/jobblitz/ (billing, user lifecycle)
```

### New / Enhanced Components

| Component | Location | Description |
|-----------|----------|-------------|
| `BaseAgent` | `packages/agents/src/BaseAgent.ts` | Abstract generic agent with cost/fallback/latency |
| `ParserAgent` | `packages/agents/src/agents/ParserAgent.ts` | Structured resume extraction from text/PDF |
| `HunterAgent` | `packages/agents/src/agents/HunterAgent.ts` | Job discovery with pluggable provider adapters |
| `MatchScorerAgent` | `packages/agents/src/agents/MatchScorerAgent.ts` | Embedding + LLM hybrid match scoring |
| `GapAnalyzerAgent` | `packages/agents/src/agents/GapAnalyzerAgent.ts` | Skill/experience gap analysis |
| `RedFlagAgent` | `packages/agents/src/agents/RedFlagAgent.ts` | Risk detection on JDs |
| `ATSRewriteAgent` | `packages/agents/src/agents/ATSRewriteAgent.ts` | Resume tailoring for ATS |
| `CoverLetterAgent` | `packages/agents/src/agents/CoverLetterAgent.ts` | Cover letter generation |
| `CompanyResearchAgent` | `packages/agents/src/agents/CompanyResearchAgent.ts` | Employer research with caching |
| `CoachPrepAgent` | `packages/agents/src/agents/CoachPrepAgent.ts` | Interview prep packs |
| `SalaryBenchmarkAgent` | `packages/agents/src/agents/SalaryBenchmarkAgent.ts` | Market salary data |
| `ComplianceAgent` | `packages/agents/src/agents/ComplianceAgent.ts` | Message compliance filtering |
| `SentimentAgent` | `packages/agents/src/agents/SentimentAgent.ts` | Conversation sentiment + churn risk |
| `CostTrackingService` | `packages/core/src/cost-tracking/` | Per-operation cost logging + burn |
| `CacheService` | `packages/core/src/cache/` | Structured Redis wrapper |
| `ComplianceService` | `packages/core/src/compliance/` | Compliance rule engine |
| `ApplicationService` | `packages/core/src/application/` | Status transitions, validation |
| `EmbeddingService` | `packages/core/src/embeddings/` | Unified embedding client |
| DailyJobHuntWorker | `apps/worker-orchestrator/src/workers/` | Scheduled job discovery per profile |
| ComplianceFilterWorker | `apps/worker-orchestrator/src/workers/` | Queued compliance checks |
| CoachHandoffWorker | `apps/worker-orchestrator/src/workers/` | Coach review queue |
| Queue Dashboard | `apps/api/src/routes/admin.ts` | Bull Board UI (guarded) |

### Data Model Additions
- `coachQueue` table — human handoff queue with priority & SLA
- `complianceLog` table — audit trail of filtered messages
- `costLog` table — per-inference cost records
- `jobAuditLog` table — BullMQ event log
- Expand `applications.status` enum with assisted_apply states

---

## 3. Phased Migration

### Phase 1 — Foundation (no breaking changes)
1. **Add schema migrations** for new tables (coachQueue, complianceLog, costLog, jobAuditLog).
2. **Create BaseAgent** + `CostTrackingService` + `CacheService` in `packages/core/`.
3. **Add ComplianceAgent** + `ComplianceService`.
4. **Add Queue Dashboard** (`/admin/queues`) behind auth guard.
5. **Update `.env.example`** with new variables.

### Phase 2 — Agents & Workers
1. **Implement specialized agents** under `packages/agents/src/agents/`: ParserAgent, HunterAgent, MatchScorerAgent, GapAnalyzerAgent, RedFlagAgent, ATSRewriteAgent, CoverLetterAgent, CompanyResearchAgent, CoachPrepAgent, SalaryBenchmarkAgent, SentimentAgent.
2. **Add ApplicationService** with explicit status transitions.
3. **Add new workers**: DailyJobHuntWorker, ComplianceFilterWorker, CoachHandoffWorker.
4. **Add job schedules** (daily job hunt, compliance batch, coach SLA check).

### Phase 3 — Integration & API Surface
1. **Wire new agents into API routes**:
   - `POST /api/resumes/parse` → ParserAgent
   - `POST /api/jobs/discover` → HunterAgent
   - `POST /api/jobs/:id/score` → MatchScorerAgent (enhanced)
   - `POST /api/applications/:id/tailor` → ATSRewriteAgent + CoverLetterAgent
   - `POST /api/applications/:id/research` → CompanyResearchAgent + SalaryBenchmarkAgent
   - `POST /api/coach/prep` → CoachPrepAgent
2. **Add compliance middleware** to outbound notification paths.
3. **Add `/api/metrics/costs`** endpoint.
4. **Update README** and write `BACKEND_ARCHITECTURE.md`.

### Phase 4 — Observability & Polish
1. **Health endpoint enrichment** — add DB, Redis, queue, LLM provider checks.
2. **Queue status endpoint** — `/api/ops/queues` with depths + rates.
3. **Structured logs** — unify on Pino/Winston style.
4. **Cost burn scaffold** — daily endpoint with TODO adapters for full tracking.

---

## 4. Exact Files to Create / Update

### New Files
```
packages/agents/src/BaseAgent.ts
packages/agents/src/agents/ParserAgent.ts
packages/agents/src/agents/HunterAgent.ts
packages/agents/src/agents/MatchScorerAgent.ts
packages/agents/src/agents/GapAnalyzerAgent.ts
packages/agents/src/agents/RedFlagAgent.ts
packages/agents/src/agents/ATSRewriteAgent.ts
packages/agents/src/agents/CoverLetterAgent.ts
packages/agents/src/agents/CompanyResearchAgent.ts
packages/agents/src/agents/CoachPrepAgent.ts
packages/agents/src/agents/SalaryBenchmarkAgent.ts
packages/agents/src/agents/ComplianceAgent.ts
packages/agents/src/agents/SentimentAgent.ts
packages/core/src/cost-tracking/index.ts
packages/core/src/cache/index.ts
packages/core/src/compliance/index.ts
packages/core/src/application/index.ts
packages/core/src/embeddings/index.ts
apps/api/src/routes/admin.ts
apps/worker-orchestrator/src/workers/DailyJobHuntWorker.ts
apps/worker-orchestrator/src/workers/ComplianceFilterWorker.ts
apps/worker-orchestrator/src/workers/CoachHandoffWorker.ts
apps/worker-orchestrator/src/workers/index.ts
```

### Updated Files
```
packages/db/src/schema.ts          — add coachQueue, complianceLog, costLog, jobAuditLog
packages/agents/src/index.ts       — export new agents
packages/agents/src/supervisor.ts  — add new agent routes
packages/agents/src/state.ts       — add new state types
apps/api/src/index.ts              — add admin routes, enhance health
apps/api/src/queue.ts              — add new queues
apps/api/src/routes/health.ts      — enhanced checks
apps/api/src/routes/jobs.ts        — add discover endpoint
apps/api/src/routes/applications.ts — add tailor, research, coach endpoints
apps/worker-orchestrator/src/index.ts — register new workers
.env.example                       — new vars
README.md                          — backend section update
```

### New Documentation
```
BACKEND_MIGRATION_PLAN.md   (this file)
BACKEND_ARCHITECTURE.md     (target state diagrams)
```

---

## 5. Integration Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing LangGraph flows | Keep existing graphs intact; new agents are additive. Wrap in supervisor if needed. |
| Schema migration conflicts | Use Drizzle migrations (already set up); additive-only in Phase 1. |
| Legacy API (Python) drift | Leave api-legacy untouched; new engine is TS-only. |
| Redis/BullMQ version mismatch | Use existing bullmq ^5.x; queue defs match. |
| Model cost explosion | CostTrackingService logs every call; daily burn endpoint surfaces it. |
| Compliance false positives | Configurable rules; default to permissive with logging. |

---

## 6. Assumptions

1. JobBlitz-AI remains the product brand; assisted_apply concepts are imported as engine logic.
2. The existing `packages/agents/` LangGraph graphs are preserved; new class-based agents coexist.
3. We use the existing LLM clients (OpenAI via LangChain, Perplexity) rather than introducing Ollama/Gemini clients unless needed.
4. WhatsApp replaces Telegram as the primary messaging channel in names, but we keep the compliance pattern identical.
5. Vector infra (pgvector + OpenAI 1536-dim embeddings) is already functional; we reuse it.
6. We do NOT build browser automation stubs in this task (already exists).
7. We do NOT remove the legacy Python API in this task.
