# JobBlitz-AI — Target State Architecture

> Target architecture for production-grade agentic job-application platform.
> Updated: 2026-05-25

## 1. Philosophy

- **Deterministic execution first, agent autonomy second**
- **Human-in-the-loop** for risky actions
- **Durable workflows** with resumability and retries
- **Strong audit trails** for every agentic action
- **MCP as the tool interoperability contract**
- **Browser execution isolated** from orchestration logic
- **Postgres + pgvector as operational memory backbone**
- **Perplexity Sonar as specialized research tool**, not general reasoning model
- **Vendor flexibility** for model routing
- **Security, privacy, and observability are first-class**

## 2. Monorepo Structure

```
/
├── apps/
│   ├── web/                  # Next.js 15 app (frontend)
│   ├── api/                  # Hono/Bun API (control plane)
│   ├── worker-orchestrator/  # LangGraph workflows + background supervisors
│   ├── worker-browser/       # Stagehand/Playwright isolated browser workers
│   └── mcp-gateway/          # Internal MCP server exposing system tools
├── packages/
│   ├── ui/                   # Shared UI components, design system
│   ├── db/                   # Schema, migrations, database client
│   ├── core/                 # Domain logic and business rules
│   ├── agents/               # Prompts, graph nodes, policies, routers
│   ├── browser/              # Stagehand flows, Playwright fallbacks, selectors
│   ├── research/             # Perplexity Sonar adapters + enrichment pipelines
│   ├── memory/               # Profile memory, retrieval, embeddings, summarization
│   ├── auth/                 # Auth config and helpers
│   ├── events/               # Queue payloads, topics, event contracts
│   ├── observability/        # Tracing, logging, metrics
│   ├── security/             # PII redaction, encryption, secrets, policy enforcement
│   ├── config/               # Env validation, shared config
│   └── types/                # Shared DTOs and zod schemas
├── infra/
│   ├── docker/               # Dockerfiles, compose files
│   ├── terraform/            # Cloud infrastructure (optional)
│   └── github/               # GitHub Actions workflows
├── mcp/
│   ├── postgres/             # MCP server for DB queries
│   ├── files/                # MCP server for artifact storage
│   ├── browser/              # MCP server for browser sessions
│   ├── email/                # MCP server for email actions
│   ├── calendar/             # MCP server for calendar actions
│   └── research/             # MCP server for research queries
├── tools/
│   ├── scripts/              # Dev scripts
│   ├── seed/                 # Database seed data
│   └── evals/                # Evaluation suites
├── docs/
│   ├── architecture/
│   ├── runbooks/
│   ├── security/
│   ├── prompts/
│   └── evals/
└── package.json              # Root workspace config (Bun workspaces)
```

## 3. Service Topology

```
                              User
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Next.js 15 (web)   │
                    │   apps/web/          │
                    └──────────┬────────────┘
                               │ tRPC / REST
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌───────────────┐ ┌──────────────┐ ┌──────────────┐
    │   Hono API    │ │  LangGraph   │ │  Browser     │
    │   (Control)   │ │  Orchestrator│ │  Worker      │
    │   Port 8000   │ │   Port 8001  │ │   Port 8002  │
    │   Bun runtime │ │   Bun runtime│ │   Bun runtime│
    └───────┬───────┘ └──────┬───────┘ └──────┬───────┘
            │                │                │
            └────────────────┼────────────────┘
                             │
                    ┌────────┴────────┐
                    │   PostgreSQL 16  │
                    │   + pgvector     │
                    │   Redis + BullMQ │
                    │   S3/R2 Storage  │
                    └─────────────────┘
                             │
                    ┌────────┴────────┐
                    │   MCP Gateway    │
                    │   (Tool Layer)   │
                    └─────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌─────────┐   ┌──────────┐   ┌──────────┐
        │ Perplexity│   │  LLM     │   │  Sentry  │
        │  Sonar   │   │ Router   │   │Langfuse  │
        └─────────┘   └──────────┘   └──────────┘
```

## 4. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 15 + TypeScript | App Router, SSR, latest features |
| Frontend | Tailwind CSS + shadcn/ui | Consistent, accessible UI |
| Frontend | tRPC | End-to-end type safety |
| API | Hono | Lightweight, fast, Bun-native |
| API Runtime | Bun | Fast startup, native TypeScript |
| Orchestration | LangGraph | Durable, resumable, human-in-the-loop workflows |
| Browser | Stagehand + Browserbase | AI-native browser primitives |
| Browser Fallback | Playwright | Deterministic flows for known ATS |
| Database | PostgreSQL 16 + pgvector | Operational DB + vector search |
| Queue / Cache | Redis + BullMQ | Typed jobs, scheduling, retries |
| Auth | Better Auth | Secure sessions, multiple providers |
| Storage | S3 / R2 / MinIO | Vendor-flexible object storage |
| Research | Perplexity Sonar API | Grounded search with citations |
| Observability | OpenTelemetry + Langfuse + Sentry | Traces, prompt observability, errors |
| Logs | Structured JSON (Pino) | Machine-parseable, contextual |
| Validation | Zod | Runtime validation at all boundaries |
| Package Manager | Bun workspaces | Fast, unified monorepo |
| Deployment | Docker-first | Cloud-agnostic, reproducible |
| CI/CD | GitHub Actions | Automated testing, linting, building |

## 5. Database Schema (Target)

### Core Tables
- `users` — identity, auth, plan, application_mode
- `profiles` — structured user profile, skills, experience, preferences
- `resumes` — resume metadata, file references, parsed text
- `cover_letters` — generated cover letters with provenance
- `jobs` — normalized job listings with embeddings
- `job_sources` — ingestion source metadata
- `applications` — application lifecycle state
- `application_runs` — durable execution runs
- `employers` — company profiles with research artifacts
- `employer_notes` — recruiter interactions, reputation signals
- `followups` — scheduled and sent follow-up communications
- `agent_runs` — LangGraph run state and checkpoint references
- `artifacts` — screenshots, resumes, traces, DOM snapshots
- `approvals` — human approval gates with decision audit
- `embeddings` — pgvector storage for semantic search

### Supporting Tables
- `credentials` — encrypted portal session data
- `job_searches` — user search configurations
- `question_answers` — reusable Q&A pairs
- `usage_logs` — billing and rate-limit tracking
- `dead_letter_logs` — failed task records
- `audit_events` — compliance audit trail
- `portal_inbox_events` — status sync from portals

### Design Principles
- UUID primary keys everywhere
- Foreign key constraints with `ON DELETE`
- JSONB for flexible sub-documents
- `created_at` / `updated_at` on every table
- Proper indexes on `(user_id, status)` and query paths
- pgvector `vector(1536)` or `vector(768)` for embeddings
- Row-level security for multi-tenant safety

## 6. API Design (Hono)

### Route Groups
- `/auth/*` — Better Auth endpoints
- `/api/v1/profile` — User profile CRUD
- `/api/v1/jobs` — Job ingestion, search, filter
- `/api/v1/resumes` — Upload, parse, manage
- `/api/v1/scoring` — Match scoring
- `/api/v1/applications` — Application lifecycle
- `/api/v1/approvals` — Approval queue
- `/api/v1/followups` — Follow-up management
- `/api/v1/research` — Company/role intelligence
- `/api/v1/health` — Health and readiness
- `/api/v1/observability` — Metrics and traces

### Principles
- Zod validation on every request and response
- Idempotency keys on mutation endpoints
- Strong typing via tRPC or OpenAPI + Zod
- Rate limiting per user and per endpoint
- CORS and CSRF protection
- Request ID propagation for tracing

## 7. LangGraph Orchestration

### Workflows
1. **Job Ingestion Graph**
   - `ingest_raw` → `normalize` → `deduplicate` → `embed` → `save`
   - Triggered by discovery workers

2. **Match Scoring Graph**
   - `fetch_profile` → `fetch_job` → `extract_requirements` → `score` → `explain` → `save`
   - Human checkpoint before auto-apply

3. **Research Enrichment Graph**
   - `identify_company` → `search_sonar` → `extract_signals` → `summarize` → `save_employer`
   - Stores citations and source metadata

4. **Resume Tailoring Graph**
   - `fetch_base_resume` → `analyze_jd` → `tailor_sections` → `generate_pdf` → `save_variant`
   - Approval checkpoint before use

5. **Application Execution Graph**
   - `load_plan` → `open_browser` → `fill_form` → `upload_resume` → `review` → `submit` → `verify`
   - Human checkpoint at `review` step
   - Retry node on failure
   - Dead letter on max retries

6. **Follow-up Scheduling Graph**
   - `check_status` → `determine_action` → `draft_message` → `approval` → `send`
   - Scheduled via BullMQ cron

7. **Stale Application Review Graph**
   - `find_stale` → `sync_status` → `update_state` → `notify_user`

### State Management
- LangGraph `StateGraph` with explicit state objects
- Checkpointing to PostgreSQL via `PostgresSaver`
- Redis for ephemeral state and pub/sub
- Human-in-the-loop via `interrupt` nodes

## 8. Browser Automation Layer

### Stagehand Primitives
- `observe(page)` — Identify page affordances
- `extract(page, schema)` — Structured data extraction
- `act(page, action)` — Precise single actions
- `agent(page, task)` — Bounded multi-step subtasks only

### Playwright Fallbacks
- Known ATS systems: Greenhouse, Lever, Ashby, Workday
- Deterministic selector flows
- Screenshot before/after critical actions
- DOM snapshot capture on failure

### Failure Classification
- `selector_drift` — UI changed, selectors broken
- `anti_bot` — CAPTCHA or bot detection triggered
- `upload_failure` — File upload rejected
- `missing_fields` — Required fields not in plan
- `unexpected_navigation` — Page redirected unexpectedly

### Artifacts
- Every browser run persists:
  - Screenshots (before/after)
  - DOM snapshots
  - Console logs
  - Network logs
  - Step-level timing

## 9. Research Layer

### Perplexity Sonar Integration
- `employer_enrichment(company_name)` — Company overview, culture, recent news
- `role_requirements_extraction(job_description)` — Structured requirements
- `recruiter_signals(company, role)` — Public recruiter information (compliant)
- `reputation_snapshot(company)` — Glassdoor, news, financial signals

### Storage
- Research artifacts stored in `employers` and `employer_notes`
- Citations preserved with source metadata
- Timestamps for freshness
- Separate from trusted structured records until normalized

## 10. Memory and Retrieval

### Operational Memory (Postgres + pgvector)
- **Profile memory**: User skills, preferences, constraints
- **Job/outcome memory**: Past applications and results
- **Employer memory**: Company interactions and signals
- **Resume-version lineage**: Tailored variants and their parents
- **Application-history retrieval**: Structured filters + semantic search

### Summarization
- Background jobs compress old agent runs into retrieval notes
- Avoid premature complexity; no separate vector DB
- Support structured filters (`user_id`, `company`, `status`) + semantic search

## 11. MCP-Native Tool Layer

### MCP Servers
- `postgres` — Query operational database
- `files` — Read/write artifacts
- `browser` — Control browser sessions
- `email` — Send and read email
- `calendar` — Schedule interviews and follow-ups
- `research` — Query Perplexity Sonar

### Contracts
- Clean tool schemas with Zod validation
- Auditable usage logs
- Documented for Claude Code and other compliant clients

## 12. Multi-Agent Specialization

### Agents (Phase 11)
- `DiscoveryAgent` — Find jobs across sources
- `MatchAgent` — Score fit and explain
- `ResumeAgent` — Tailor resumes and cover letters
- `ApplyAgent` — Execute applications
- `FollowUpAgent` — Manage post-application communication
- `ResearchAgent` — Enrich company and role data

### Supervisor/Router
- Narrow scope per agent
- Shared memory + APIs
- No duplicate business logic
- Graceful degradation to deterministic services when LLM confidence is low

## 13. Observability

### OpenTelemetry
- Traces across API, workers, and browser runs
- Request ID propagation
- Database query spans
- External API call spans

### Langfuse
- Prompt versioning and tracking
- Tool call instrumentation
- Outcome logging
- Cost tracking per model

### Sentry
- Error tracking and alerting
- Release health
- Performance monitoring

### Structured Logs
- Pino JSON logs
- Contextual fields (request_id, user_id, agent_name, run_id)
- PII redaction before output

## 14. Security Model

### Authentication
- Better Auth with secure session management
- OAuth providers (Google, LinkedIn)
- Session rotation and expiry

### Authorization
- Role-based access control (user, admin)
- Resource ownership checks
- Rate limiting per user tier

### Data Protection
- Encryption at rest for sensitive artifacts
- PII redaction from logs and traces
- Credential encryption with rotating keys
- Secret validation at startup

### Audit
- Every approval decision logged
- Every application submission traced
- Every agent action recorded
- Immutable audit event stream

### Threat Mitigation
- Input validation (Zod) on all boundaries
- Prompt injection filtering for web content
- Anti-bot escalation paths
- CSRF protection
- Secure headers (HSTS, CSP, etc.)

## 15. Developer Experience

- `bun dev` — Start all services in development
- `bun db:seed` — Seed local database
- `bun test` — Run all tests
- `bun lint` — Lint all packages
- `bun typecheck` — Type check all packages
- `.env.example` — Documented environment variables
- One-command local startup via Docker Compose
- Under-30-minute onboarding for new engineers

## 16. Model Strategy

- **Primary coding/build assistant**: Claude Code
- **Research provider**: Perplexity Sonar
- **Open interfaces** for Anthropic, OpenAI, Google, OpenRouter
- **Separate concerns**: research, reasoning, browser control
- **No hardcoded provider** in domain logic
- **Model routing** via packages/core/llm_router.ts

## 17. Non-Goals

- Do NOT rebuild around GBrain as the primary runtime
- Do NOT overfit to one LLM vendor
- Do NOT create a toy demo
- Do NOT add premature complexity (separate vector DB, Kubernetes, etc.)
- Do NOT rewrite working scrapers unless necessary
- Do NOT break existing data model without migration path
