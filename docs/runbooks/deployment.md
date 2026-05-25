# Deployment Runbook

> How to deploy JobBlitz-AI to production.
> Updated: 2026-05-25

## Overview

JobBlitz-AI deploys as a set of Docker containers. The primary target is cloud-agnostic Docker deployment, with specific guides for common platforms.

## Architecture

```
┌─────────────────────────────────────────────┐
│                 Load Balancer                │
│            (Cloudflare / AWS ALB)           │
└──────────────┬──────────────────┬───────────┘
               │                  │
     ┌─────────┘                  └──────────┐
     ▼                                       ▼
┌─────────┐                          ┌─────────┐
│   Web   │                          │   API   │
│ Next.js │                          │  Hono   │
│ :3000   │                          │ :8000   │
└─────────┘                          └────┬────┘
                                          │
                         ┌────────────────┼────────────────┐
                         │                │                │
                         ▼                ▼                ▼
                   ┌─────────┐     ┌──────────┐     ┌──────────┐
                   │   DB    │     │  Redis   │     │  Worker  │
                   │Postgres │     │  BullMQ  │     │Orchestr. │
                   │ :5432   │     │  :6379   │     │  :8001   │
                   └─────────┘     └──────────┘     └──────────┘
                                                         │
                                                   ┌─────┴─────┐
                                                   │           │
                                                   ▼           ▼
                                             ┌─────────┐  ┌─────────┐
                                             │ Browser │  │   MCP   │
                                             │ Worker  │  │ Gateway │
                                             │  :8002  │  │  :8003  │
                                             └─────────┘  └─────────┘
```

## Environment Requirements

### Production

- Docker 24.0+
- Docker Compose 2.20+ (for simple deployments)
- Kubernetes 1.28+ (for orchestrated deployments)
- PostgreSQL 16 + pgvector
- Redis 7+
- S3-compatible object storage
- (Optional) Cloudflare R2 / AWS S3

### Resource Requirements (Minimum)

| Service | CPU | Memory | Storage |
|---------|-----|--------|---------|
| Web | 0.5 | 512MB | 1GB |
| API | 1.0 | 1GB | 1GB |
| Worker Orchestrator | 1.0 | 2GB | 5GB |
| Worker Browser | 2.0 | 4GB | 10GB |
| MCP Gateway | 0.5 | 512MB | 1GB |
| PostgreSQL | 1.0 | 2GB | 50GB |
| Redis | 0.5 | 512MB | 5GB |

### Resource Requirements (Recommended)

| Service | CPU | Memory | Storage |
|---------|-----|--------|---------|
| Web | 1.0 | 1GB | 5GB |
| API | 2.0 | 4GB | 10GB |
| Worker Orchestrator | 2.0 | 4GB | 20GB |
| Worker Browser | 4.0 | 8GB | 50GB |
| MCP Gateway | 1.0 | 1GB | 5GB |
| PostgreSQL | 2.0 | 4GB | 200GB |
| Redis | 1.0 | 2GB | 20GB |

## Deployment Methods

### Method 1: Docker Compose (Simple)

Best for: Single server, development, small scale.

```bash
# 1. Clone repo
git clone <repo-url> jobblitz-ai
cd jobblitz-ai

# 2. Configure environment
cp .env.example .env
# Edit .env with production values

# 3. Start services
docker compose -f docker-compose.prod.yml up -d

# 4. Run migrations
docker compose exec api bun db:migrate

# 5. Verify health
curl https://your-domain.com/health
```

### Method 2: Kubernetes (Recommended for Scale)

Best for: Multi-node, auto-scaling, high availability.

See `infra/kubernetes/` for manifests:

```bash
# Apply configurations
kubectl apply -k infra/kubernetes/overlays/production/

# Verify
kubectl get pods -n jobblitz
kubectl get svc -n jobblitz
```

### Method 3: Cloud Platform Specific

#### AWS
- Use ECS Fargate for stateless services (Web, API, Workers)
- Use RDS PostgreSQL with pgvector extension
- Use ElastiCache Redis
- Use S3 for object storage
- Use Application Load Balancer

#### Google Cloud
- Use Cloud Run for stateless services
- Use Cloud SQL for PostgreSQL (enable pgvector)
- Use Memorystore for Redis
- Use Cloud Storage
- Use Cloud Load Balancing

#### Hetzner / DigitalOcean / Linode
- Use Docker Compose on dedicated VMs
- Use managed PostgreSQL and Redis if available
- Use Cloudflare R2 for object storage
- Use Cloudflare Load Balancer

## Environment Variables

### Required

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/jobblitz

# Redis
REDIS_URL=redis://host:6379/0

# Auth
BETTER_AUTH_SECRET=32+char-random-string
BETTER_AUTH_URL=https://api.your-domain.com

# API
API_URL=https://api.your-domain.com
WEB_URL=https://your-domain.com

# Object Storage
S3_ENDPOINT=https://s3.your-provider.com
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET_NAME=jobblitz-production
```

### Optional but Recommended

```bash
# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
PERPLEXITY_API_KEY=pplx-...

# Observability
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
SENTRY_DSN=https://...@sentry.io/...
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-collector.your-domain.com

# Browser
BROWSERBASE_API_KEY=...
STAGEHAND_ENABLED=true

# Feature Flags
ENABLE_LANGGRAPH=true
ENABLE_STAGEHAND=true
```

## Database Migrations

### Automatic Migrations (Recommended)

API container runs migrations on startup:

```dockerfile
# In Dockerfile
CMD ["bun", "run", "migrate-and-start"]
```

### Manual Migrations

```bash
# Connect to running API container
docker compose exec api bun db:migrate

# Or run as one-off job
kubectl create job manual-migration --from=cronjob/api-migration -n jobblitz
```

### Rollback

```bash
# Drizzle rollback
bun db:migrate:rollback

# Or restore from backup
pg_restore -h host -U user -d jobblitz backup.sql
```

## SSL/TLS

### Cloudflare (Recommended)

1. Add domain to Cloudflare
2. Set SSL/TLS mode to "Full (strict)"
3. Create Origin CA certificate
4. Mount certificate in reverse proxy

### Let's Encrypt

```yaml
# In docker-compose.prod.yml
services:
  traefik:
    image: traefik:v3
    command:
      - "--providers.docker=true"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@your-domain.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "443:443"
    volumes:
      - "./letsencrypt:/letsencrypt"
      - "/var/run/docker.sock:/var/run/docker.sock"
```

## Health Checks

### Readiness Probes

```bash
# API
curl -f http://api:8000/health/ready || exit 1

# Web
curl -f http://web:3000/api/health || exit 1

# Workers
curl -f http://worker-orchestrator:8001/health || exit 1
curl -f http://worker-browser:8002/health || exit 1
```

### Liveness Probes

```bash
# Same endpoints, but with timeout
curl -f --max-time 5 http://api:8000/health/live || exit 1
```

## Monitoring

### Metrics

Prometheus metrics available at:
- API: `http://api:8000/metrics`
- Workers: `http://worker-orchestrator:8001/metrics`

### Logs

Structured JSON logs are written to stdout. Aggregate with:
- Cloudflare Logpush
- Datadog
- Grafana Loki
- AWS CloudWatch

Example log query:
```json
{"service":"api","level":"error","request_id":"abc123"}
```

### Alerts

Configure alerts for:
- High error rate (>1%)
- High latency (p99 >2s)
- Queue depth (>1000 jobs)
- Database connections (>80%)
- Disk usage (>80%)
- Memory usage (>85%)

## Backup and Recovery

### Database

```bash
# Automated daily backup
pg_dump -h host -U user -d jobblitz | gzip > backup-$(date +%Y%m%d).sql.gz

# Restore
 gunzip < backup-20260101.sql.gz | psql -h host -U user -d jobblitz
```

### Object Storage

Enable versioning and cross-region replication on S3/R2 bucket.

### Configuration

Store `.env` in encrypted secret manager:
- AWS Secrets Manager
- Google Secret Manager
- HashiCorp Vault
- 1Password Secrets Automation

## Scaling

### Horizontal Scaling

Stateless services (Web, API, MCP Gateway) can scale horizontally:

```yaml
# docker-compose.prod.yml
services:
  api:
    deploy:
      replicas: 3
```

### Vertical Scaling

Stateful services (Worker Browser, PostgreSQL) scale vertically:

```yaml
services:
  worker-browser:
    deploy:
      resources:
        limits:
          cpus: '8'
          memory: 16G
```

### Queue Scaling

Monitor BullMQ queue depth and scale workers:

```bash
# Check queue depth
bun run --filter=worker-orchestrator queue:status

# Scale workers
docker compose up -d --scale worker-orchestrator=5
```

## Security

### Network

```yaml
# docker-compose.prod.yml
services:
  postgres:
    networks:
      - internal
    # No external ports

  redis:
    networks:
      - internal
    # No external ports
```

### Secrets

```bash
# Never commit .env
echo ".env" >> .gitignore

# Use Docker secrets
docker secret create db_password -
docker secret create api_key -
```

### Updates

```bash
# Update base images
docker compose pull
docker compose up -d

# Security updates only
docker compose up -d --no-deps --build api
```

## Troubleshooting Production

### High CPU
```bash
# Identify process
docker stats

# Profile Bun
docker exec api bun profile
```

### Memory Leaks
```bash
# Check heap usage
docker exec api bun --inspect run heap-snapshot
```

### Database Slow Queries
```sql
-- Find slow queries
SELECT query, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Queue Backlog
```bash
# Check BullMQ queues
docker exec worker-orchestrator bun run queue:inspect
```

## Rollback Procedure

1. **Database**: Do not rollback schema. Keep additive migrations only.
2. **Services**: Revert to previous Docker image tag.
3. **Configuration**: Roll back `.env` changes.
4. **Verify**: Run smoke tests after rollback.

```bash
# Rollback API to previous version
docker compose pull api:previous-tag
docker compose up -d api

# Verify
curl https://api.your-domain.com/health
```

## CI/CD

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run lint
      - run: bun run typecheck
      - run: bun test
      - run: bun run build
      - run: docker build -t jobblitz/api:${{ github.sha }} -f apps/api/Dockerfile .
      - run: docker push jobblitz/api:${{ github.sha }}
      - run: ssh deploy@server "cd /app && docker compose pull && docker compose up -d"
```

## Checklist

Before deploying:
- [ ] `.env` configured with production values
- [ ] Database migrations tested
- [ ] SSL/TLS certificates valid
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] Backups configured
- [ ] Rollback plan documented
- [ ] Secrets in secure storage
- [ ] Feature flags configured
- [ ] Load testing passed
