# JobBlitz-AI — Architecture Decision Log

> Record of key architectural decisions and their rationale.
> Updated: 2026-05-25

## ADR-001: Bun + TypeScript for Runtime and Language

**Status**: Accepted

**Context**: The existing codebase is split between Python (backend, orchestrator, browser worker) and TypeScript (frontend). The target architecture requires a unified language and fast runtime.

**Decision**: Use Bun as the runtime and TypeScript as the primary language for all new services.

**Rationale**:
- Bun offers fast startup, native TypeScript support, and built-in bundling
- TypeScript enables end-to-end type safety from database to frontend
- Single language reduces cognitive load and enables code sharing via workspaces
- Hono (Bun-native framework) is lightweight and fast for APIs

**Consequences**:
- Existing Python services must be rewritten or wrapped
- Team must learn Bun-specific APIs and Hono patterns
- Docker images change from Python to Bun base

**Alternatives considered**:
- Keep Python (FastAPI) for backend — rejected because it perpetuates language split
- Use Node.js instead of Bun — rejected because Bun is faster and has built-in TypeScript
- Use Deno — rejected because Bun has better npm compatibility and ecosystem maturity

---

## ADR-002: Drizzle ORM over Prisma

**Status**: Proposed

**Context**: Need a TypeScript ORM that supports PostgreSQL, async queries, and pgvector.

**Decision**: Use Drizzle ORM.

**Rationale**:
- Drizzle is SQL-like and transparent, reducing abstraction overhead
- Excellent TypeScript inference
- Native pgvector support via extensions
- Lightweight compared to Prisma
- Migrations are plain SQL

**Consequences**:
- Less ecosystem tooling than Prisma
- No built-in schema visualization
- Manual migration management

**Alternatives considered**:
- Prisma — rejected due to heavier abstraction and pgvector support complexity
- Raw SQL (postgres.js) — rejected because ORM provides type safety and migration management
- Kysely — rejected because Drizzle has better DX and built-in migration tool

---

## ADR-003: LangGraph over Custom Agent Framework

**Status**: Proposed

**Context**: The existing ADK orchestrator is a custom Python agent dispatcher with no true workflow engine, checkpointing, or resumability.

**Decision**: Use LangGraph for workflow orchestration.

**Rationale**:
- LangGraph provides durable, resumable workflows with explicit state management
- Human-in-the-loop support via interrupts
- PostgresSaver for checkpointing
- Graph-based visualization and debugging
- Active ecosystem and documentation

**Consequences**:
- Learning curve for graph-based programming
- Dependency on LangChain ecosystem
- Need to port existing agent logic to graph nodes

**Alternatives considered**:
- Keep custom Python agents — rejected because no durability or checkpointing
- Temporal.io — rejected because it's heavier and adds infrastructure complexity
- Custom workflow engine — rejected because it reinvents the wheel

---

## ADR-004: Stagehand + Browserbase for Browser Automation

**Status**: Proposed

**Context**: Existing browser automation uses raw Playwright. Target architecture specifies Stagehand.

**Decision**: Use Stagehand with Browserbase as primary, Playwright as fallback.

**Rationale**:
- Stagehand provides AI-native primitives (observe, extract, act) that reduce brittle selector maintenance
- Browserbase offers managed browser infrastructure with session persistence
- Playwright fallback ensures deterministic known flows still work
- Stagehand is built on Playwright, so fallback is natural

**Consequences**:
- Stagehand is newer and may have edge cases
- Browserbase adds external dependency and cost
- Need to maintain both Stagehand and Playwright code paths

**Alternatives considered**:
- Keep raw Playwright only — rejected because it doesn't provide AI-native primitives
- Use Scrapy/ScrapingBee — rejected because they don't match the agentic workflow model
- Puppeteer — rejected because Playwright is more capable and Stagehand is built on it

---

## ADR-005: PostgreSQL + pgvector for Memory

**Status**: Proposed

**Context**: Need operational memory with semantic search. Target specifies Postgres + pgvector.

**Decision**: Use PostgreSQL 16 with pgvector extension.

**Rationale**:
- Operational database already exists; adding pgvector avoids separate vector DB infrastructure
- pgvector supports HNSW and IVFFlat indexes for fast similarity search
- ACID transactions for embedding writes
- Row-level security for multi-tenant safety
- No additional infrastructure to manage

**Consequences**:
- pgvector performance may not match dedicated vector DBs at extreme scale
- Need to manage vector dimensionality carefully
- Backup and restore includes vector data

**Alternatives considered**:
- Pinecone — rejected because it adds infrastructure cost and complexity
- Weaviate — rejected because it's heavier than needed
- Chroma — rejected because it's less mature and lacks ACID guarantees
- Qdrant — rejected because PostgreSQL is already operational DB

---

## ADR-006: BullMQ over ARQ

**Status**: Proposed

**Context**: Existing backend uses ARQ (Python Redis queue). Target specifies BullMQ.

**Decision**: Use BullMQ for job queues.

**Rationale**:
- BullMQ is TypeScript-native and integrates with Bun
- Rich features: delayed jobs, rate limiting, job dependencies, repeatable jobs
- Built-in UI (bull-board or bullmq-ui)
- Redis-backed, same infrastructure as ARQ
- Supports job progress and event emission

**Consequences**:
- Need to rewrite ARQ worker tasks as BullMQ jobs
- Redis data format changes
- Job retry logic must be reimplemented

**Alternatives considered**:
- Keep ARQ — rejected because it's Python-only and doesn't fit TypeScript stack
- Inngest — rejected because it adds external dependency and is less mature
- Temporal.io — rejected because it's heavier than needed for background jobs

---

## ADR-007: Better Auth over Auth.js

**Status**: Proposed

**Context**: Existing auth is custom JWT with Supabase. Target mentions Better Auth or Auth.js.

**Decision**: Use Better Auth.

**Rationale**:
- Better Auth is designed for modern frameworks (Next.js, Hono) with type safety
- Session-based auth with secure cookies
- OAuth providers out of the box
- Database adapters for Drizzle/Prisma
- Self-hosted, no external auth service dependency

**Consequences**:
- Migration from custom JWT to session-based auth
- Need to migrate existing user sessions
- Documentation is newer than Auth.js

**Alternatives considered**:
- Auth.js (NextAuth) — rejected because Better Auth has better database integration and type safety
- Clerk — rejected because it's SaaS and adds cost; target prefers self-hosted
- Keep custom JWT — rejected because it lacks OAuth, session rotation, and modern security features

---

## ADR-008: S3/R2 over Supabase Storage

**Status**: Proposed

**Context**: Existing storage uses Supabase Storage. Target specifies S3/R2-compatible.

**Decision**: Use generic S3 client with configurable provider.

**Rationale**:
- Vendor flexibility — can use AWS S3, Cloudflare R2, MinIO, or Supabase
- S3 is the de facto standard for object storage
- R2 has no egress fees, reducing costs
- MinIO for local development

**Consequences**:
- Need to migrate existing Supabase Storage files
- URL generation logic changes
- Need to manage S3 credentials

**Alternatives considered**:
- Keep Supabase Storage — rejected because it locks us to Supabase
- Use Cloudflare R2 exclusively — rejected because generic S3 allows provider switching
- Use local filesystem — rejected because it doesn't scale and lacks durability

---

## ADR-009: tRPC over REST

**Status**: Proposed

**Context**: Need typed API communication between frontend and backend.

**Decision**: Use tRPC for internal API communication, REST for external/public APIs.

**Rationale**:
- tRPC provides end-to-end type safety without code generation
- Excellent integration with Next.js and React Query
- Reduces API contract drift
- Hono has tRPC adapter

**Consequences**:
- Adds dependency on tRPC ecosystem
- Not ideal for external/public APIs (use OpenAPI + REST for those)
- Learning curve for new developers

**Alternatives considered**:
- GraphQL — rejected because it's heavier and overkill for this use case
- OpenAPI + generated clients — rejected because it requires build step and codegen
- Raw REST — rejected because it lacks type safety

---

## ADR-010: MCP as Tool Interoperability Contract

**Status**: Proposed

**Context**: Need a standardized way for AI agents and external tools to interact with system capabilities.

**Decision**: Use Model Context Protocol (MCP) as the tool interoperability contract.

**Rationale**:
- MCP is becoming the standard for AI tool integration
- Supported by Anthropic, Claude Code, and growing ecosystem
- Clean tool contracts with JSON schemas
- Auditable and secure

**Consequences**:
- MCP spec is still evolving
- Need to build and maintain MCP servers
- Adds architectural complexity

**Alternatives considered**:
- Custom HTTP API tools — rejected because it reinvents the wheel and lacks standardization
- Function calling directly — rejected because it's not interoperable across clients
- OpenAPI tools — rejected because MCP is designed specifically for AI agent tool use

---

## ADR-011: Pino over Winston/Bunyan

**Status**: Proposed

**Context**: Need structured logging for observability.

**Decision**: Use Pino for structured JSON logging.

**Rationale**:
- Pino is fast and lightweight
- Built-in JSON output
- Child loggers for request context
- Redaction support
- Works well with Bun

**Consequences**:
- Need to configure redaction rules
- Log aggregation setup required

**Alternatives considered**:
- Winston — rejected because Pino is faster and has better Bun support
- Built-in console — rejected because it's not structured
- Logtape — rejected because Pino is more mature

---

## ADR-012: Biome over ESLint + Prettier

**Status**: Proposed

**Context**: Need linting and formatting for the monorepo.

**Decision**: Use Biome for linting and formatting.

**Rationale**:
- Biome is fast (Rust-based)
- Single tool for linting and formatting
- Good TypeScript support
- Works well with Bun
- Simpler configuration than ESLint + Prettier

**Consequences**:
- Less plugin ecosystem than ESLint
- Some rules may differ from ESLint defaults
- Migration from existing ESLint config if any

**Alternatives considered**:
- ESLint + Prettier — rejected because Biome is faster and simpler
- oxlint — rejected because it's lint-only; Biome handles formatting too

---

## ADR-013: Keep Python Scrapers During Migration

**Status**: Accepted

**Context**: The existing backend has 7+ job discovery scrapers and ATS adapters in Python. Rewriting them immediately would block progress.

**Decision**: Keep Python scrapers operational during migration. Wrap them as microservices or migrate incrementally.

**Rationale**:
- Scrapers are complex and heavily tested
- Selector drift is a constant maintenance burden
- Rewriting would delay core architectural work
- Can expose scrapers via HTTP API for TypeScript services to call

**Consequences**:
- Temporary Python service remains in stack
- Slightly more complex deployment
- Need to maintain both codebases temporarily

**Alternatives considered**:
- Rewrite all scrapers in TypeScript immediately — rejected because it's high risk and low value relative to core architecture
- Use Scrapy in TypeScript — rejected because no mature equivalent exists

---

## ADR-014: Docker Compose for Local Dev, Docker for Deployment

**Status**: Accepted

**Context**: Need consistent local development and cloud deployment.

**Decision**: Use Docker Compose for local dev, Docker images for cloud deployment.

**Rationale**:
- Docker Compose provides one-command local startup
- Each service has its own Dockerfile
- Cloud-agnostic deployment
- Easy to add/remove services during migration

**Consequences**:
- Not as scalable as Kubernetes
- Volume management for local data

**Alternatives considered**:
- Kubernetes for local dev — rejected because it's too heavy
- Nix — rejected because learning curve is steep
- Direct local installation — rejected because it lacks reproducibility

---

## ADR-015: No Separate Dev/Prod Dockerfiles

**Status**: Accepted

**Context**: Should we maintain separate Dockerfiles for dev and prod?

**Decision**: Use a single Dockerfile per service with multi-stage builds.

**Rationale**:
- Simpler maintenance
- Dev and prod use same base image
- Multi-stage builds optimize production image size
- Environment differences handled via env vars

**Consequences**:
- Slightly slower local builds if not cached
- Need to ensure dev tools are not in final stage

**Alternatives considered**:
- Separate Dockerfiles — rejected because it duplicates logic and causes drift
- Docker Compose override files — accepted for dev-specific overrides
