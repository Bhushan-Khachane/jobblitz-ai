# Local Development Runbook

> How to set up and run JobBlitz-AI locally.
> Updated: 2026-05-25

## Prerequisites

- Docker & Docker Compose
- Bun 1.1+ (`curl -fsSL https://bun.sh/install | bash`)
- Git
- (Optional) Claude Code or compatible AI coding assistant

## Quick Start (One Command)

```bash
# Clone and enter repository
git clone <repo-url> jobblitz-ai
cd jobblitz-ai

# Install dependencies and start everything
bun install
bun dev
```

This starts:
- PostgreSQL 16 + pgvector on `localhost:5432`
- Redis on `localhost:6379`
- API (Hono/Bun) on `http://localhost:8000`
- Web (Next.js 15) on `http://localhost:3000`
- Worker Orchestrator (LangGraph) on `http://localhost:8001`
- Worker Browser (Stagehand) on `http://localhost:8002`
- MCP Gateway on `http://localhost:8003`

## Manual Setup

### 1. Environment Variables

```bash
cp .env.example .env
# Edit .env and fill in required variables
```

Required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `SECRET_KEY` — 32+ character random string
- `BETTER_AUTH_SECRET` — Better Auth secret
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` — Object storage

Optional but recommended:
- `OPENAI_API_KEY` — For LLM routing
- `ANTHROPIC_API_KEY` — For Claude models
- `PERPLEXITY_API_KEY` — For research
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` — For observability
- `SENTRY_DSN` — For error tracking

### 2. Database

```bash
# Start database services
docker compose up -d postgres redis

# Run migrations
bun db:migrate

# Seed local data
bun db:seed
```

### 3. Install Dependencies

```bash
bun install
```

### 4. Build Packages

```bash
bun run build
```

### 5. Start Services

```bash
# Terminal 1: API
bun run --filter=api dev

# Terminal 2: Web
bun run --filter=web dev

# Terminal 3: Worker Orchestrator
bun run --filter=worker-orchestrator dev

# Terminal 4: Worker Browser
bun run --filter=worker-browser dev

# Or use Docker Compose for everything:
docker compose up
```

## Services and Ports

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| Web | 3000 | http://localhost:3000 | Next.js 15 frontend |
| API | 8000 | http://localhost:8000 | Hono/Bun API |
| API Docs | 8000 | http://localhost:8000/docs | OpenAPI/Swagger UI |
| Health | 8000 | http://localhost:8000/health | System health |
| Worker Orchestrator | 8001 | http://localhost:8001 | LangGraph workflows |
| Worker Browser | 8002 | http://localhost:8002 | Stagehand browser |
| MCP Gateway | 8003 | http://localhost:8003 | MCP tools |
| PostgreSQL | 5432 | localhost:5432 | Operational DB |
| Redis | 6379 | localhost:6379 | Cache + queues |

## Common Commands

```bash
# Run all tests
bun test

# Run tests for specific package
bun run --filter=core test

# Lint all packages
bun run lint

# Type check all packages
bun run typecheck

# Format code
bun run format

# Database operations
bun db:migrate      # Run pending migrations
bun db:seed         # Seed local database
bun db:studio       # Open Drizzle Studio
bun db:generate     # Generate migration from schema changes

# Docker operations
docker compose up -d      # Start all services
docker compose down        # Stop all services
docker compose logs -f api # Follow API logs

# Reset local database
docker compose down -v     # Remove volumes
bun db:migrate
bun db:seed
```

## Debugging

### API
```bash
# Start with debugger
bun --inspect run --filter=api dev
```

### Browser Worker
```bash
# Run with visible browser (non-headless)
HEADLESS=false bun run --filter=worker-browser dev
```

### Database Queries
```bash
# Connect with psql
docker compose exec postgres psql -U jobblitz -d jobblitz

# Or use Drizzle Studio
bun db:studio
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
```

## Troubleshooting

### Port Conflicts
If ports are already in use:
```bash
# Check what's using a port
lsof -i :3000

# Kill process or change ports in .env
```

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker compose ps

# Check logs
docker compose logs postgres

# Reset if corrupted
docker compose down -v
docker compose up -d postgres
```

### Bun Install Failures
```bash
# Clear cache
bun pm cache rm

# Reinstall
rm -rf node_modules
bun install
```

### Type Errors
```bash
# Ensure all packages are built
bun run build

# Check specific package
bun run --filter=api typecheck
```

## Working with Legacy Services

During migration, legacy Python services are available:

```bash
# Start legacy backend
docker compose up -d api-legacy

# Legacy API available at http://localhost:8004
```

## Feature Flags

Some features are behind flags in `packages/config/src/flags.ts`:

```typescript
export const flags = {
  enableLanggraph: process.env.ENABLE_LANGGRAPH === 'true',
  enableStagehand: process.env.ENABLE_STAGEHAND === 'true',
  enableNewFrontend: process.env.ENABLE_NEW_FRONTEND === 'true',
};
```

Toggle via `.env`:
```bash
ENABLE_LANGGRAPH=true
ENABLE_STAGEHAND=true
ENABLE_NEW_FRONTEND=true
```

## Adding a New Package

```bash
# Create directory
mkdir -p packages/my-package/src

# Add package.json
cat > packages/my-package/package.json << 'EOF'
{
  "name": "@jobblitz/my-package",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {},
  "devDependencies": {}
}
EOF

# Add tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}

# Reinstall
bun install
```

## IDE Setup

### VS Code
Install extensions:
- Biome (or ESLint + Prettier)
- Tailwind CSS IntelliSense
- TypeScript Hero
- Docker

### Cursor
The project includes `.cursor/skills` for AI-assisted development.

## Useful Resources

- [Bun Documentation](https://bun.sh/docs)
- [Hono Documentation](https://hono.dev)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Better Auth Documentation](https://www.better-auth.com)
- [tRPC Documentation](https://trpc.io)
- [Stagehand Documentation](https://docs.stagehand.dev)
