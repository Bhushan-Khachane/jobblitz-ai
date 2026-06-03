# JobBlitz-AI Backend Architecture

**Version:** 2.1 (post assisted_apply integration)  
**Date:** 2026-05-29

---

## Philosophy

JobBlitz-AI remains the product-facing application and brand. The backend now integrates an internal **Apply Engine** inspired by [assisted_apply](https://github.com/Bhushan-Khachane/assisted_apply.git). The engine provides reusable, generic logic for:

- AI agents (specialized, class-based, with fallback)
- Queue/worker orchestration
- Compliance filtering
- Cost tracking
- Application state management

Product-specific logic (billing, user lifecycle, app flows) stays under JobBlitz-AI namespaces.

---

## Layer Diagram

```
┌─────────────────────────────────────────────┐
│  apps/web          Next.js 15 (product UI)   │
├─────────────────────────────────────────────┤
│  apps/api          Hono REST API            │
│  ├─ /api/jobs      CRUD + discover            │
│  ├─ /api/applications  orchestration hooks    │
│  ├─ /api/resumes   parse → ingestion queue   │
│  ├─ /api/health    enriched health checks     │
│  ├─ /api/ops       metrics + costs + queues   │
│  └─ /admin/queues  queue dashboard (guarded)  │
├─────────────────────────────────────────────┤
│  apps/worker-orchestrator  BullMQ workers     │
│  ├─ orchestration-jobs   (legacy LangGraph)  │
│  ├─ daily-job-hunt       Hunter + Match      │
│  ├─ compliance-filter    outbound gate       │
│  ├─ coach-handoff        human review queue    │
│  └─ profile-ingestion    ParserAgent flow    │
├─────────────────────────────────────────────┤
│  packages/agents       Specialized agents    │
│  ├─ BaseAgent          cost / fallback       │
│  ├─ ParserAgent        resume → structured   │
│  ├─ HunterAgent        job discovery         │
│  ├─ MatchScorerAgent   embedding + rule      │
│  ├─ GapAnalyzerAgent   skill gap analysis    │
│  ├─ RedFlagAgent       JD risk detection     │
│  ├─ ATSRewriteAgent    resume tailoring      │
│  ├─ CoverLetterAgent   CL generation         │
│  ├─ CompanyResearchAgent employer research    │
│  ├─ CoachPrepAgent     interview prep        │
│  ├─ SalaryBenchmarkAgent market data         │
│  ├─ ComplianceAgent    message filtering     │
│  └─ SentimentAgent     churn risk detection  │
├─────────────────────────────────────────────┤
│  packages/core         Domain services       │
│  ├─ cost-tracking      per-inference billing │
│  ├─ cache              Redis wrapper           │
│  ├─ compliance         rule engine            │
│  ├─ application        status transitions      │
│  ├─ scoring            match algorithm       │
│  └─ embeddings         OpenAI embeddings     │
├─────────────────────────────────────────────┤
│  packages/db           Drizzle ORM + pgvector │
│  packages/memory       semantic search         │
│  packages/browser      Playwright + Stagehand  │
│  packages/research     Perplexity / Sonar      │
│  packages/security     vault, rate limit, PII  │
│  packages/observability OTel + Langfuse        │
├─────────────────────────────────────────────┤
│  Postgres 16 + pgvector  │  Redis 7  │  S3/R2 │
└─────────────────────────────────────────────┘
```

---

## Data Model Additions

### `coach_queue`
Human handoff queue with priority & SLA.

| Field | Type | Notes |
|-------|------|-------|
| userId | UUID FK | |
| applicationId | UUID FK nullable | |
| priority | int | 1 = urgent, 5 = low |
| triggerReason | text | why it was created |
| assignedTo | varchar | coach identifier |
| status | enum | open / assigned / resolved / escalated |
| slaDeadline | timestamp | default now + 4h |

### `compliance_log`
Audit trail for every outbound message check.

### `cost_log`
Per-inference cost records (micro-dollars to avoid float issues).

### `job_audit_log`
BullMQ event log for observability.

---

## Agent Design

All new agents extend `BaseAgent<I, O>`:

- `run(input)` — primary logic
- `fallbackResult(input)` — safe output on failure
- `execute(input)` — wraps run with latency logging and try/catch

Agents are intentionally **pluggable**:
- Rule-based implementations work today.
- TODO comments mark where LLM calls (OpenAI, Gemini, Ollama) should be injected.

---

## Queue / Worker Design

| Queue | Concurrency | Purpose |
|-------|-------------|---------|
| `orchestration-jobs` | 3 | Legacy LangGraph application flow + new tailoring action |
| `daily-job-hunt` | 2 | Periodic discovery per profile |
| `compliance-filter` | 5 | Gate all outbound WhatsApp/email/SMS |
| `coach-handoff` | 3 | Human review queue |
| `profile-ingestion` | 3 | Resume text → structured profile |

Workers log to `job_audit_log` on completion and failure.

---

## API Changes

### New Endpoints

| Method | Path | Action |
|--------|------|--------|
| POST | /api/jobs/discover | Trigger HunterAgent |
| POST | /api/resumes/:id/parse | Enqueue profile ingestion |
| POST | /api/applications/:id/tailor | Enqueue tailoring |
| POST | /api/applications/:id/research | Run company + salary research |
| POST | /api/applications/:id/coach-prep | Generate interview prep |
| GET | /api/ops/costs | Daily burn + engine breakdown |
| GET | /api/ops/queues | All queue depths |
| GET | /admin/queues | Admin queue dashboard |

### Enhanced Endpoints

- `GET /api/health` → returns DB, Redis, LLM key status
- `GET /api/health/ready` → readiness probe

---

## Compliance

The `ComplianceService` uses configurable regex rules. Default rules block:
- Guarantees of placement
- Upfront payment requests
- Misleading salary claims
- Discriminatory language
- MLM language

Every outbound message (except system messages) passes through `ComplianceAgent`.

---

## Cost Tracking

`CostTrackingService` logs every agent execution to `cost_log`.

- `dailyBurn(userId?)` — last 24h spend
- `perEngineBreakdown()` — by LLM provider
- `monthlyEstimate()` — projection based on current burn

Stored in **micro-dollars** (integer) to avoid floating-point issues.

---

## Status Mapping (assisted_apply → JobBlitz-AI)

| assisted_apply | JobBlitz-AI |
|----------------|-------------|
| discovered | pending |
| shortlisted | pending |
| tailoring | pending |
| coach_review | pending |
| manual_review | pending |
| ready_to_apply | approved |
| applied | submitted |
| follow_up | submitted (with followUpStatus) |
| interview | interview |
| rejected | rejected |
| offer | accepted |

The existing `applications` enum is preserved to avoid migrations. The new workers map states logically.

---

## Next Steps / TODOs

The following have been implemented in this migration:

1. ✅ **LLM Integration** — `packages/core/src/llm/` with OpenAIProvider, GeminiProvider, LLMRouter.
2. ✅ **HunterAgent Providers** — Stubs + MockJobProvider in `packages/agents/src/agents/HunterAgent.ts`.
3. ✅ **Salary Data Source** — `SalaryBenchmarkAgent` with LLM-first + stub fallback.
4. ✅ **WhatsApp Sender** — `WhatsAppSender` wired into `ComplianceFilterWorker`.
5. ✅ **Coach Notifications** — `SlackWebhook` wired into `CoachHandoffWorker` for priority-1 alerts.
6. ✅ **Cost Tracking** — `CostTrackingService` + `LLMRouter` `onCostLog` callback.
7. ✅ **Bull Board UI** — `@bull-board/express` mounted on separate port (default 8001) and proxied via `/admin/board/*`.
8. ✅ **Cron Schedules** — BullMQ repeatable jobs: daily hunt every 6h, compliance batch at 02:00 IST, tailor batch at 02:00 IST.

### Additional fixes applied
- ✅ **Bull Board proxy** — `GET`/`HEAD` requests skip body forwarding to avoid `fetch` errors.
- ✅ **Default cost logger** — `registerDefaultCostLogger` in `LLMRouter` allows singleton agents (which create their own routers) to automatically log costs via a module-level callback. Wired in `worker-orchestrator` to persist to `costLog` table.
- ✅ **exactOptionalPropertyTypes** — All interfaces (`CostEntry`, `CostLogCallback`, `OrchestrationJobData`, etc.) explicitly allow `undefined`.

Remaining future work (out of scope):
- Real browser-automation adapters for LinkedIn/Naukri/Indeed (currently stubs).
- OAuth-based social login integration.
- Multi-tenant workspace isolation.
- Resume PDF parse (currently text-only ingestion pipeline).
