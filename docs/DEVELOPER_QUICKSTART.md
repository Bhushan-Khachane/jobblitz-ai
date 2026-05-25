# Developer Quickstart

## Prerequisites

- macOS or Linux (Windows via WSL2)
- [Bun](https://bun.sh) 1.3+ (`curl -fsSL https://bun.sh/install | bash`)
- Docker & Docker Compose
- Python 3.12+ (for legacy backend)
- `uv` or `pip` for Python dependencies

## One-Command Local Start

```bash
bun run dev:all
```

This starts all 8 services in dependency order with health checks:
1. PostgreSQL (Docker pgvector)
2. Redis (Docker)
3. api-legacy (FastAPI/uvicorn on 8004)
4. api (Hono on 8000)
5. worker-orchestrator (BullMQ worker)
6. worker-browser (Playwright worker)
7. mcp-gateway (port 4000)
8. web (Next.js on 3000)

## Manual Start (if you prefer)

### 1. Infrastructure

```bash
docker compose up -d postgres redis
```

### 2. Python Backend (api-legacy)

```bash
cd apps/api-legacy
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8004
```

### 3. TypeScript API (api)

```bash
cd apps/api
bun install
bun run dev
```

### 4. Web Frontend

```bash
cd apps/web
bun install
bun run dev
```

### 5. Workers

```bash
# Terminal A — Orchestrator
cd apps/worker-orchestrator
bun run dev

# Terminal B — Browser worker
cd apps/worker-browser
bun run dev

# Terminal C — ARQ worker (Python)
cd apps/api-legacy
source .venv/bin/activate
arq arq_worker.WorkerSettings
```

## Environment Variables

Copy `.env.example` to `.env` at the repo root and fill in:

```bash
# Required
DATABASE_URL=postgresql+asyncpg://jobblitz:jobblitz@localhost:5432/jobblitz
REDIS_URL=redis://localhost:6379/0
BETTER_AUTH_SECRET=<32+ char secret>
VAULT_MASTER_KEY=<32+ char secret>

# AI Providers (at least one)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
OPENROUTER_API_KEY=sk-or-v1-...

# Optional
RESEND_API_KEY=re_...
STRIPE_SECRET_KEY=sk_...
MCP_API_KEY=<random>
```

## Database Migrations

### TypeScript (Drizzle)

```bash
cd packages/db
bun run db:generate  # generate migrations
bun run db:migrate   # apply migrations
bun run db:studio    # Drizzle Studio GUI
```

### Python (Alembic)

```bash
cd apps/api-legacy
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Type Checking

```bash
# All packages
bun run typecheck

# Single package
cd packages/security && bun run typecheck
```

## Python Linting

```bash
cd apps/api-legacy
ruff check app/
ruff check --fix app/
```

## Testing

```bash
# TypeScript packages
bun run test

# Python backend
pytest apps/api-legacy/tests/

# E2E
cd apps/api && bun run test:e2e
```

## Evals

```bash
cd tools/evals
bun run src/index.ts
```

## Deployment

```bash
# Production deploy to Fly.io
bun run deploy
```

See `scripts/deploy-fly.sh` and individual `fly.toml` files for service-level configuration.

## Architecture Overview

```
Frontend (Next.js 15) ──REST/SSE──> API (Hono) ──REST──> API Legacy (FastAPI)
                                      │
                                      ├──> BullMQ ──> Worker Orchestrator (LangGraph)
                                      │                 └──> Browser Worker (Playwright)
                                      │
                                      ├──> MCP Gateway (port 4000, internal)
                                      │
                                      └──> PostgreSQL (pgvector) + Redis
```

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `apps/web` | Next.js 15 frontend |
| `apps/api` | Hono TypeScript API |
| `apps/api-legacy` | FastAPI Python backend |
| `apps/worker-orchestrator` | BullMQ + LangGraph application worker |
| `apps/worker-browser` | Playwright browser automation worker |
| `apps/mcp-gateway` | MCP server with domain-specific tools |
| `packages/db` | Drizzle schema + migrations |
| `packages/agents` | LangGraph graphs + nodes |
| `packages/browser` | ATS adapters (Greenhouse, Lever, Naukri, LinkedIn, etc.) |
| `packages/memory` | pgvector semantic search + embeddings |
| `packages/security` | Vault, credential proxy, PII redaction, rate limiting |
| `packages/observability` | OpenTelemetry tracing + Langfuse + metrics |
| `packages/config` | Plan tiers + env validation |

## Common Issues

### `bun run typecheck` fails on `@jobblitz/*` imports

Make sure workspace dependencies are linked:

```bash
bun install
```

### Postgres connection refused

```bash
docker compose up -d postgres
# Wait 5s, then:
# DATABASE_URL should use localhost (not docker service name) for local dev
```

### Redis connection refused

```bash
docker compose up -d redis
```

### ARQ worker won't start

Make sure Redis is running and `REDIS_URL` is correct:

```bash
redis-cli ping  # should return PONG
```

## Getting Help

- Build log: `docs/BUILD_LOG.md`
- Architecture: `docs/architecture/`
- Runbooks: `docs/runbooks/`
- Pressure-tested report: `PRESSURE_TESTED_REPORT.md`
