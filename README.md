# JobBlitz AI 🚀

> Trust-centered, India-focused autonomous job application platform — AI discovers, scores, tailors, and applies to jobs on LinkedIn and Naukri while you approve the best matches.

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Bun 1.3+ (`curl -fsSL https://bun.sh/install | bash`)
- Python 3.12+ (for legacy backend)

### One-Command Local Start

```bash
git clone https://github.com/Bhushan-Khachane/jobblitz-ai.git
cd jobblitz-ai
cp .env.example .env  # fill in required keys
bun install
bun run dev:all
```

This starts all 8 services in dependency order: Postgres (pgvector), Redis, FastAPI legacy, Hono API, BullMQ orchestrator, browser worker, MCP gateway, and Next.js web app.

### Services

| Service | URL | Description |
|---------|-----|-------------|
| Web Frontend | http://localhost:3000 | Next.js 15 + Tailwind + shadcn/ui |
| API (Hono) | http://localhost:8000 | TypeScript API + SSE dashboard |
| API Legacy | http://localhost:8004 | FastAPI + ARQ workers |
| API Docs | http://localhost:8004/docs | Swagger UI |
| MCP Gateway | http://localhost:4000/mcp | Internal MCP tools |
| Health Check | http://localhost:8004/health/ | System health |

## How It Works

1. **Upload your resume** — AI extracts skills, experience, and preferences
2. **Set target roles** — Job titles, locations, salary, experience level
3. **Connect accounts** — Secure cloud browser login (passwords never touch our servers)
4. **Choose application mode**:
   - **Manual**: Discover + tailor, you apply yourself
   - **Assisted**: AI prepares everything, you approve before submit (default)
   - **Auto**: AI auto-applies for high-confidence, low-risk matches
5. **JobBlitz runs discovery** every 2 hours, scores matches with AI, and queues applications
6. **Real-time dashboard** shows live progress via SSE — approve, skip, or let it run

## Architecture

```
Frontend (Next.js 15) ──REST/SSE──> API (Hono) ──REST──> API Legacy (FastAPI)
                                      │
                                      ├──> BullMQ ──> Worker Orchestrator
                                      │                 ├─ LangGraph application flow
                                      │                 ├─ Daily Job Hunt worker
                                      │                 ├─ Profile Ingestion worker
                                      │                 ├─ Compliance Filter worker
                                      │                 └─ Coach Handoff worker
                                      │
                                      ├──> Browser Worker (Playwright + Stagehand)
                                      │
                                      ├──> MCP Gateway (internal tools)
                                      │
                                      └──> PostgreSQL (pgvector) + Redis
```

### Backend Engine (assisted_apply-inspired)

JobBlitz-AI now integrates an internal **Apply Engine** inspired by [assisted_apply](https://github.com/Bhushan-Khachane/assisted_apply.git). The engine provides:

- **13 specialized AI agents** with `BaseAgent<I, O>` pattern, cost tracking, and fallback handling
- **5 BullMQ queues**: orchestration, daily job hunt, compliance filter, coach handoff, profile ingestion
- **Compliance layer**: Configurable rule engine for outbound WhatsApp/email safety
- **Cost tracking**: Per-inference billing with daily burn and monthly estimates
- **Application state machine**: Clean status transitions with validation

Product-specific logic (billing, user lifecycle, app flows) remains under JobBlitz-AI namespaces.

### Key Technologies

- **Frontend**: Next.js 15 + TypeScript + Tailwind + shadcn/ui + Framer Motion
- **API Layer**: Hono (TypeScript) + FastAPI (Python legacy)
- **Workers**: BullMQ (TypeScript) + ARQ (Python) — async job queues
- **AI/LLM**: OpenAI GPT-4o-mini, Google Gemini, OpenRouter (Kimi K2.6)
- **Browser Automation**: Playwright + Stagehand v3 + stealth for Naukri
- **ATS Adapters**: Greenhouse, Lever, Ashby, Workday, Naukri, LinkedIn
- **Semantic Search**: pgvector (1536-dim embeddings) + HNSW index + hybrid ranking
- **Observability**: OpenTelemetry + Langfuse + custom metrics
- **Billing**: Stripe Checkout + subscription tiers (Free / Pro / Elite)
- **Security**: AES-256-GCM vault, credential proxy (TTL + single-use), PII redaction

## Pricing

| Plan | Monthly | Annual | Daily Applies | Key Features |
|------|---------|--------|---------------|--------------|
| **Free** | $0 | $0 | 10 | Manual mode, 3 saved searches |
| **Pro** | $12 / ₹999 | $120 / ₹9990 | 50 | All modes, semantic search, 5 AI resume + cover letter/day |
| **Elite** | $29 / ₹2499 | $290 / ₹24990 | Unlimited | Priority workers, interview prep, ATS checker, resume translator, email follow-up |

## Project Structure

```
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   ├── api/                    # Hono TypeScript API
│   ├── api-legacy/             # FastAPI Python backend
│   ├── worker-orchestrator/    # BullMQ + LangGraph application worker
│   ├── worker-browser/         # Playwright browser automation worker
│   └── mcp-gateway/            # MCP server with domain-specific tools
├── packages/
│   ├── db/                     # Drizzle schema + migrations
│   ├── agents/                 # LangGraph graphs + nodes
│   ├── browser/                # ATS adapters (Greenhouse, Lever, Naukri, LinkedIn)
│   ├── memory/                 # pgvector semantic search + embeddings
│   ├── security/               # Vault, credential proxy, PII redaction, rate limiting
│   ├── observability/          # OpenTelemetry tracing + Langfuse + metrics
│   └── config/                 # Plan tiers + env validation
├── scripts/
│   ├── dev-all.sh              # One-command local orchestrator
│   └── deploy-fly.sh          # Fly.io production deployment
├── docker/
│   ├── Dockerfile.api-legacy   # Multi-stage Python 3.12-slim (<400MB)
│   └── Dockerfile.worker-browser # Playwright base (<800MB)
├── docs/
│   ├── DEVELOPER_QUICKSTART.md
│   ├── BUILD_LOG.md
│   └── architecture/
├── fly.toml                    # Fly.io configs (6 services)
├── docker-compose.yml          # Local dev stack
├── docker-compose.prod.yml     # Production stack
└── README.md
```

## India-Specific Features

- **LPA salary parsing**: "12-15 LPA" → normalized average
- **Notice period matching**: 30/60/90 days standard
- **Metro city clusters**: Bangalore/Bengaluru, Gurgaon/Gurugram, etc.
- **Title normalization**: SDE → software engineer, SSE → senior software engineer
- **Skill synonyms**: react/reactjs/React.js, node/nodejs/Node.js
- **Naukri stealth automation**: Rotated UAs, human-like delays, locale spoofing
- **INR pricing**: ₹999/₹2499 monthly with 2 months free on annual

## Application Pipeline

1. **Discovery** — `HunterAgent` discovers jobs via pluggable providers (LinkedIn, Naukri, etc.) every 6h
2. **Scoring** — `MatchScorerAgent` + `RedFlagAgent` compute fit score and risk check
3. **Tailoring** — `ATSRewriteAgent` tailors resume + `CoverLetterAgent` generates cover letter
4. **Coach Review** — Low-confidence tailoring triggers `CoachHandoffWorker` (4h SLA)
5. **Approval** (assisted mode) — User reviews and approves via dashboard
6. **Application** — Browser worker fills forms via ATS adapters
7. **Compliance** — `ComplianceFilterWorker` gates all outbound WhatsApp/email messages
8. **Follow-up** — Automated reminders after 7 days of no response
9. **Status sync** — Portal inbox syncs interview/rejection updates

### Agent Roster

| Agent | Purpose | Status |
|-------|---------|--------|
| ParserAgent | Resume text → structured profile | Rule-based (LLM TODO) |
| HunterAgent | Job discovery with provider adapters | Mock providers (real TODO) |
| MatchScorerAgent | Embedding + rule-based fit scoring | Hybrid active |
| GapAnalyzerAgent | Missing skills + upgrade path | Rule-based active |
| RedFlagAgent | Scam/risk detection on JDs | Keyword heuristic active |
| ATSRewriteAgent | Resume tailoring for ATS | Rule-based (LLM TODO) |
| CoverLetterAgent | Cover letter generation | Template-based (LLM TODO) |
| CompanyResearchAgent | Employer research | Perplexity integration ready |
| CoachPrepAgent | Interview prep packs | Template-based (LLM TODO) |
| SalaryBenchmarkAgent | Market salary data | Stub (real source TODO) |
| ComplianceAgent | Message safety filter | Rule-based active |
| SentimentAgent | Churn risk detection | Keyword heuristic active |

## Notifications

- **Real-time SSE**: Dashboard streams live events (discovered, applied, failed, approval needed)
- **Daily digest**: Email summary of new jobs, applications, pending approvals
- **Follow-up reminders**: Polite follow-up emails for silent applications
- **Notification preferences**: `/settings/notifications` — toggle emails, digest frequency, follow-ups

## Observability

- **Traces**: OpenTelemetry OTLP export for every HTTP request and BullMQ job
- **Metrics**: Applications submitted, match score histogram, LLM call duration, queue depth
- **LLM tracing**: Langfuse integration for all AI calls
- **Admin dashboard**: `/ops` — queue depths, daily stats, active browser sessions, errors (admin only)

## Security

- **Zero-password storage**: Session cookies only — credentials never stored plaintext
- **Credential proxy**: In-memory, TTL 120s, single-use tokens for browser automation
- **PII redaction**: Email, phone, Aadhaar, PAN redacted from logs and LLM prompts
- **AES-256-GCM vault**: PBKDF2 key derivation with per-user salts
- **Rate limiting**: Redis-backed sliding window — 100 LLM calls/hour, plan-based daily apply limits

## Deployment

### Fly.io (Production)

```bash
bun run deploy
```

Deploys 6 services in dependency order, sets secrets from `.env.production`, runs migrations, and prints URLs.

### Docker Compose (Self-hosted)

```bash
docker compose -f docker-compose.prod.yml up -d
```

Includes Postgres, Redis, all services with health checks and restart policies.

## Developer Guide

See [`docs/DEVELOPER_QUICKSTART.md`](docs/DEVELOPER_QUICKSTART.md) for:
- Manual service startup
- Database migrations (Drizzle + Alembic)
- Type checking, linting, testing
- Evals and E2E tests
- Common issues and debugging

## License

MIT
