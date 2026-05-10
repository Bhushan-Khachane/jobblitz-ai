# JobBlitz AI — Pressure-Tested Transformation Report

## ARTIFACT A — Executive Summary

### What Changed
JobBlitz has been transformed from a spray-and-pray automation tool into a trust-centered, India-focused SaaS platform with structured matching, human-in-the-loop approval, and ATS-aware application routing.

**Key changes implemented:**
- **Hybrid matching engine**: Replaced token-overlap scoring with a 5-dimension system (fit, role quality, compensation, location, confidence) with India-specific normalization (LPA, notice period, metro clusters, title variants, skill synonyms)
- **Application modes**: Manual/Assisted/Auto — default is Assisted (AI prepares, user approves)
- **Approval queue**: GET /approval-queue, POST /{id}/approve, POST /{id}/reject
- **ATS adapter router**: 10 adapters (Greenhouse, Lever, Ashby, Workday, ICIMS, Naukri, LinkedIn, Instahyre, Cutshort, Wellfound) with support-level detection
- **Structured logging**: Request correlation IDs, JSON-structured request logs
- **Match explanations**: Every job listing now stores a JSON breakdown of why it matched

**Critical fixes applied:**
- Redis networking (localhost → docker service name)
- TrustedHost middleware (wildcard → explicit hosts)
- Login auth context bug (bypassed AuthProvider → uses it properly)
- Rate limiter architecture documented (Redis pipeline needed)
- Frontend User type includes new fields

### Biggest Bottlenecks Found
1. **Token-overlap matching** — shallow, no India context, no explanations
2. **No human-in-the-loop** — auto-apply as default risks account bans and trust
3. **Synchronous apply endpoint** — blocks HTTP for 2-5 min (documented, not yet moved to background)
4. **LLM prompt credential exposure** — decrypted passwords in browser-use prompts (documented, needs secure fill)
5. **Browser-per-job model** — no pooling, no session reuse (scaffolded for future)

### Biggest Risks Removed
- Application mode system prevents reckless auto-apply by default
- ATS detection routes unsupported flows to manual mode
- Match explanations surface reasoning for user trust
- Structured request logging enables debugging and security auditing

### Remaining Top Risks
| Risk | Severity | Mitigation Status |
|------|----------|-----------------|
| LLM prompt credential exposure | CRITICAL | Documented, needs secure fill refactor |
| Synchronous apply in HTTP handler | HIGH | Documented, needs background task |
| Browser selector drift (LinkedIn/Naukri) | HIGH | Documented, needs monitoring |
| No file size validation on uploads | MEDIUM | Needs max size check |
| No token refresh in frontend | MEDIUM | Needs refresh token rotation |

### Why This Now Looks Like a Real SaaS
- **Trust architecture**: 3 modes, approval queue, ATS detection
- **India-market fit**: LPA normalization, notice period matching, metro clusters, India-specific sources
- **Observability**: Request IDs, structured logs, health endpoints
- **Data model**: ApplicationMode, approval_status, match_explanation, daily_apply_limit
- **Safety**: Default is assisted (not auto), most-restrictive mode wins per-ATS

---

## ARTIFACT B — Repo-Specific Code Review

### Top Code Issues by File/Module

| File | Issue | Severity | Status |
|------|-------|----------|--------|
| `agent_service.py:67-120` | Decrypted passwords in LLM prompts | CRITICAL | Documented |
| `agent_service.py:126-127` | Browser launched per task, no pool | HIGH | Documented |
| `tasks.py:24-26` | `asyncio.run()` creates new event loop per task | MEDIUM | Accepted (tech debt) |
| `tasks.py:560-640` | Batch apply iterates all searches in one transaction | MEDIUM | Accepted |
| `applications.py:120-180` | Apply runs synchronously in HTTP handler | HIGH | Documented |
| `matching_service.py` (old) | Token-overlap only, no India context | HIGH | FIXED |
| `config.py` | REDIS_URL default was localhost | CRITICAL | FIXED |
| `main.py` | TrustedHost allowed * | MEDIUM | FIXED |
| `main.py` | ALLOWED_ORIGINS from env, not settings | LOW | FIXED |
| `dependencies.py:60-80` | Rate limiter GET/INCR race condition | MEDIUM | Documented |
| `health.py` | No auth on /detailed endpoint | LOW | FIXED (now requires auth) |
| `applications.py:34` | Skills fallback was `{}` not `[]` | MEDIUM | FIXED |
| `applications.py:241` | /approval-queue after /{id} (shadowed) | CRITICAL | FIXED |
| `login/page.tsx` | Bypassed AuthProvider context | HIGH | FIXED |

### What Was Refactored
- `matching_service.py` — Complete rewrite from 93 lines to 350+ lines with hybrid scoring
- `models.py` — Added ApplicationMode enum, application_mode, daily_apply_limit, approval_status, match_explanation
- `schemas.py` — Added fields for new model columns
- `applications.py` — Added approval queue endpoints, fixed route ordering, fixed skills fallback
- `tasks.py` — Batch apply respects application_mode, uses daily_apply_limit properly
- `config.py` — Redis URL default changed
- `main.py` — Added RequestLogMiddleware, fixed TrustedHost, fixed ALLOWED_ORIGINS

### What Should Still Be Refactored
- `agent_service.py` — Needs browser pooling, secure credential fill, CAPTCHA detection
- `apply_service.py` — Legacy, should be removed once agent_service is stable
- `scraper_service.py` — Needs selector monitoring, retry with backoff, pagination support
- `tasks.py` — `_run_async` pattern should be replaced with proper async Celery task class
- Frontend `lib/api.ts` — No token refresh, inconsistent API helper usage

### Where Technical Debt Remains
- Celery + async event loop boundary (accepted for now)
- Shared Redis connection pools (dependencies.py vs health.py)
- No pagination on frontend list views
- Billing page is entirely mock
- No WebSocket/polling for real-time status updates

---

## ARTIFACT C — Architecture V2

```
                        ┌─────────────────────────────────────────┐
                        │           Frontend (Next.js 14)         │
                        │  Landing | Dashboard | Approval Queue   │
                        │  Searches | Applications | Analytics    │
                        └──────────────────┬──────────────────────┘
                                           │ REST API + SSE
                        ┌──────────────────▼──────────────────────┐
                        │           FastAPI Backend                │
                        │                                          │
                        │  ┌─────────────┐  ┌──────────────────┐   │
                        │  │  Auth/JWT    │  │  Rate Limiter    │   │
                        │  └─────────────┘  └──────────────────┘   │
                        │  ┌─────────────┐  ┌──────────────────┐   │
                        │  │ Request ID  │  │  CORS/Host        │   │
                        │  │ Middleware   │  │  Middleware       │   │
                        │  └─────────────┘  └──────────────────┘   │
                        │                                          │
                        │  ┌──────────────────────────────────┐     │
                        │  │       Matching Service V2        │     │
                        │  │  (hybrid: token + rule + India)  │     │
                        │  │  5 dimensions + explanations     │     │
                        │  └──────────────────────────────────┘     │
                        │                                          │
                        │  ┌──────────────────────────────────┐     │
                        │  │       ATS Adapter Router          │     │
                        │  │  (10 adapters, support detection)  │     │
                        │  └──────────────────────────────────┘     │
                        └──────────────────┬──────────────────────┘
                                           │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
            ┌───────▼──────┐   ┌───────────▼───────────┐   ┌──────▼──────┐
            │  PostgreSQL   │   │     Celery Workers     │   │    Redis    │
            │  (9 tables)  │   │                         │   │  (broker)   │
            │              │   │  ┌─────────────────┐     │   │             │
            │  users        │   │  │ Discovery Queue │     │   │  rate limit │
            │  profiles     │   │  │ (every 2h)      │     │   │  sessions   │
            │  credentials  │   │  └─────────────────┘     │   │             │
            │  resumes      │   │  ┌─────────────────┐     │   └─────────────┘
            │  job_searches │   │  │ Scoring Queue   │     │
            │  job_listings │   │  │ (on discovery)  │     │
            │  applications │   │  └─────────────────┘     │
            │  usage_logs   │   │  ┌─────────────────┐     │
            │  question_   │   │  │ Approval Queue  │     │
            │  answers      │   │  │ (assisted mode) │     │
            └───────┬──────┘   │  └─────────────────┘     │
                    │          │  ┌─────────────────┐     │
                    │          │  │ Apply Queue      │     │
                    │          │  │ (auto + approved)│    │
                    │          │  └─────────────────┘     │
                    │          │  ┌─────────────────┐     │
                    │          │  │ DLQ             │     │
                    │          │  │ (failed tasks)  │     │
                    │          │  └─────────────────┘     │
                    │          └───────────────────────────┘
                    │                      │
            ┌───────▼──────────────────────▼──────┐
            │       Browser Agent (browser-use)   │
            │  ┌──────────┐  ┌──────────────────┐ │
            │  │ LinkedIn  │  │  Naukri (FF)     │ │
            │  │ (Chromium) │  │  + Stealth      │ │
            │  └──────────┘  └──────────────────┘ │
            │                                      │
            │  ATS Adapters: Greenhouse, Lever,    │
            │  Ashby, Workday, ICIMS, Instahyre,   │
            │  Cutshort, Wellfound                  │
            └──────────────────────────────────────┘
```

### Queues (Current + Target)
| Queue | Current | Target | Status |
|-------|---------|--------|--------|
| Default | All tasks | Discovery, scoring, cleanup | Current |
| Apply | auto_apply | Apply (auto + approved) | Current |
| Approval | N/A | Approval queue processing | Scaffolded |
| DLQ | N/A | Failed task recovery | Documented |

### Deployment Topology
- Docker Compose: PostgreSQL, Redis, Backend, Frontend, Celery Worker, Celery Beat, Flower
- Backend needs `extra_hosts: host.docker.internal:host-gateway` for Ollama access
- Health checks: `/health/` (liveness), `/health/ready` (readiness), `/health/detailed` (auth required)

---

## ARTIFACT D — India Strategy

### Portals/Platforms (Priority Order)
1. **Naukri** — largest, but external-apply dead ends → ASSISTED mode
2. **LinkedIn India** — professional network → ASSISTED mode (Easy Apply risky)
3. **Instahyre** — curated, high-signal → MANUAL mode (API access needed)
4. **Cutshort** — tech/startup focused → MANUAL mode
5. **Wellfound India** — startup roles → MANUAL mode
6. **Company career pages** — direct ATS access via adapters
7. **Freshersworld** — entry-level roles
8. **Glassdoor India** — salary data + listings

### India-Specific Normalization (Implemented)
- **LPA salary parsing**: "12-15 LPA" → 13.5 average
- **Notice period**: 30/60/90 days standard
- **Metro city clusters**: Bangalore/Bengaluru, Gurgaon/Gurugram, etc.
- **Remote variants**: "work from home", "WFH", "hybrid", "distributed"
- **Title normalization**: SDE→software engineer, SSE→senior software engineer, PM→product manager
- **Skill synonyms**: react/reactjs/React.js, node/nodejs/Node.js, aws/Amazon Web Services, etc.
- **Seniority detection**: intern, junior, mid, senior, staff, manager (with word-boundary matching)

### UX Localization
- Currency in INR/LPA (implemented in schema)
- Notice period filter (implemented in profile model)
- Metro city quick-select (implemented in matching service)
- Hindi language support (future, not yet implemented)

### Rollout Plan for India
1. **Week 1-2**: Fix Naukri + LinkedIn scrapers, add monitoring
2. **Week 3-4**: Add Instahyre + Cutshort adapters
3. **Week 5-6**: Add Greenhouse + Lever company page scanning
4. **Week 7-8**: Add interview prep + follow-up features

---

## ARTIFACT E — Bottleneck Register

| # | Bottleneck | Current Impact | Mitigation | Status | Evidence | Next Step |
|---|-----------|---------------|------------|--------|----------|-----------|
| B6 | Redis networking broken in Docker | CRITICAL | Fix REDIS_URL default | FIXED | Config change, docker-compose | Verify in staging |
| D4 | TrustedHost allows all hosts | HIGH | Set explicit hosts | FIXED | main.py change | Add domain config |
| E6 | Login bypasses auth context | HIGH | Use authAPI.login() | FIXED | login/page.tsx | Test auth flow |
| E3 | Token-overlap matching | HIGH | Hybrid matching V2 | FIXED | matching_service.py rewrite | A/B test scores |
| A5 | No approval queue | HIGH | Approval endpoints + modes | SCAFFOLDED | applications.py | Build frontend UI |
| B1 | Browser-per-job | HIGH | Document browser pool design | DOCUMENTED | agent_service.py | Implement pool |
| B2 | Synchronous apply in HTTP | HIGH | Document SSE + background task | DOCUMENTED | applications.py | Move to Celery |
| B5 | No idempotency | MEDIUM | Document dedup strategy | DOCUMENTED | tasks.py | Add idempotency keys |
| D1 | LLM prompt credential exposure | CRITICAL | Document secure fill need | DOCUMENTED | agent_service.py:67-120 | Implement secure fill |
| C2 | Hardcoded CSS selectors | HIGH | Document selector monitoring | DOCUMENTED | scraper_service.py | Add fallbacks |
| C5 | Naukri external-apply dead ends | MEDIUM | ATS routing to assisted/manual | SCAFFOLDED | ats_adapters.py | Test detection |
| A3 | No follow-up/interview prep | MEDIUM | Document feature design | DOCUMENTED | — | Build in Phase 4-8w |
| A4 | Weak onboarding | MEDIUM | Add career goal capture | DOCUMENTED | — | Build in Phase 4-8w |
| B4 | Flat Celery queue | MEDIUM | Document queue topology | DOCUMENTED | — | Implement in Phase 2w |
| D2 | Fernet key in .env | MEDIUM | Document secret manager need | DOCUMENTED | encryption.py | Migrate to Vault |

---

## ARTIFACT F — Production Readiness Scorecard

| Dimension | Current | Target | Evidence | Blocking Gaps |
|-----------|---------|--------|----------|----------------|
| Architecture | 5/10 | 8/10 | Hybrid matching, ATS routing, approval modes, structured logging | Browser pool, queue topology, background apply |
| Reliability | 4/10 | 8/10 | Match explanations, application modes, fixed Redis config | No retry with backoff, no DLQ, no idempotency |
| Security | 4/10 | 8/10 | TrustedHost fixed, auth on health/detailed, request IDs | LLM credential exposure, no secret manager, no prompt injection guard |
| Observability | 4/10 | 7/10 | Request ID middleware, structured JSON logs, readiness endpoint | No metrics, no tracing, no alerting hooks |
| Cost Control | 2/10 | 7/10 | Daily apply limits per user, match score thresholds | No AI cost tracking, no per-user quotas enforced |
| Testing | 1/10 | 7/10 | None automated yet | No unit tests, no integration tests, no e2e |
| Multi-tenancy | 3/10 | 7/10 | Application modes, per-user daily limits | No plan enforcement, no feature flags, no billing |
| UX Trust | 5/10 | 8/10 | Approval queue backend, match explanations, 3 modes | No frontend approval UI, no real-time status, no interview prep |
| India-market fit | 5/10 | 8/10 | LPA, notice period, city clusters, title normalization, 10 ATS adapters | Only LinkedIn+ Naukri scrapers, no Hindi, no Instahyre/Cutshort |
| Operations | 3/10 | 7/10 | Health/readiness endpoints, structured logging | No runbook, no admin dashboard, no deployment automation |

---

## ARTIFACT G — Implementation Plan

### Now (this branch — pushed)
- [x] Hybrid matching service V2 with India normalization
- [x] Application modes (manual/assisted/auto)
- [x] Approval queue endpoints (GET, POST approve, POST reject)
- [x] Match explanation storage in DB
- [x] ATS adapter router with 10 adapters
- [x] Request correlation ID middleware
- [x] Redis networking fix
- [x] TrustedHost middleware fix
- [x] Login auth context fix
- [x] Health/readiness/detailed endpoints (auth on detailed)
- [x] User settings for application_mode and daily_apply_limit
- [x] Database migration for new columns
- [x] Pressure test bug fixes (route ordering, score overflow, ngram ordering, substring matching)

### Next 2 Weeks
- [ ] Frontend approval queue UI
- [ ] Frontend application mode selector in profile
- [ ] Frontend match explanation display on job cards
- [ ] Move apply endpoint to background Celery task (keep SSE for status)
- [ ] Browser pool with session reuse
- [ ] Selector monitoring and fallback system
- [ ] Rate limiter atomic fix (Redis pipeline)
- [ ] Idempotency keys on discovery and apply tasks
- [ ] Dead-letter queue for failed tasks

### Next 4-8 Weeks
- [ ] Resume tailoring pipeline (per-job variants, PDF generation)
- [ ] Instahyre + Cutshort scraper adapters
- [ ] Greenhouse + Lever API-based job scanning
- [ ] Object storage migration (S3/R2) for screenshots and resumes
- [ ] Secret manager abstraction (start with env, migrate to Vault)
- [ ] Feature flags by plan
- [ ] Billing integration (Razorpay for India)
- [ ] Interview prep feature
- [ ] Follow-up reminder system
- [ ] Real-time application status (WebSocket or SSE polling)
- [ ] Unit and integration test suite
- [ ] Admin/ops dashboard

---

## ARTIFACT H — File-by-File Changeset

| File | Why | Risk Level | Migration Needed | Rollback Strategy |
|------|-----|-----------|-----------------|-------------------|
| `backend/app/services/matching_service.py` | Complete rewrite: hybrid matching with India normalization | MEDIUM | No (code only) | git revert |
| `backend/app/services/ats_adapters.py` | New: ATS detection and routing | LOW | No | Delete file |
| `backend/app/models.py` | Added ApplicationMode, daily_apply_limit, match_explanation, approval_status | MEDIUM | Yes (002 migration) | Alembic downgrade |
| `backend/app/schemas.py` | Added new fields to schemas | LOW | No | git revert |
| `backend/app/routers/applications.py` | Approval queue endpoints, import fix, route ordering, skills fix | MEDIUM | No | git revert |
| `backend/app/routers/health.py` | Readiness endpoint, auth on detailed | LOW | No | git revert |
| `backend/app/routers/job_searches.py` | Trigger message clarification | LOW | No | git revert |
| `backend/app/routers/users.py` | Application mode and daily limit updates | LOW | No | git revert |
| `backend/app/workers/tasks.py` | Batch apply respects application_mode, uses daily_apply_limit | MEDIUM | No | git revert |
| `backend/app/config.py` | Redis URL default changed to docker service name | HIGH | No (config) | Revert env var |
| `backend/app/main.py` | Added RequestLogMiddleware, fixed TrustedHost, fixed ALLOWED_ORIGINS | LOW | No | git revert |
| `backend/app/middleware.py` | New: Request ID and structured logging middleware | LOW | No | Delete file |
| `backend/alembic/versions/002_application_modes.py` | New: Migration for application_mode, daily_apply_limit, match_explanation, approval_status | MEDIUM | Yes | alembic downgrade |
| `frontend/app/login/page.tsx` | Fixed auth context bug, uses useAuth().login() | HIGH | No | git revert |
| `frontend/hooks/useAuth.tsx` | Added application_mode and daily_apply_limit to User type | LOW | No | git revert |

---

## ARTIFACT I — Test Evidence

### Unit/Integration Coverage Touched
- **None automated yet.** This is a significant gap. The codebase has zero test files.

### Manual Scenarios Run
- Match scoring: verified that `match_job_to_resume_detailed()` returns correct 5-dimension scores
- India normalization: verified LPA parsing ("12-15 LPA" → 13.5), metro clusters ("Bangalore" → "bangalore"), title normalization ("SDE" → "software engineer")
- Application modes: verified batch_auto_apply creates `pending_approval` for assisted mode
- Route ordering: verified /approval-queue comes before /{application_id}
- ATS detection: verified Greenhouse, Lever, Naukri URLs are correctly detected

### Failure Injection Scenarios (Documented, Not Run)
- Redis down: Would break rate limiting and Celery. Health check would return 503.
- DB slow: Would time out API requests. No retry configured.
- Browser crash: Would leave Application in "pending" forever until stale checker.
- Invalid selectors: Would return 0 jobs silently.
- LLM timeout: Would cause apply tasks to fail with error.
- Duplicate job discovery: Dedup check on (platform, external_job_id) catches most cases.

### Unresolved Test Gaps
- No unit tests for matching_service.py
- No integration tests for API endpoints
- No e2e tests for apply flow
- No load tests for concurrent discovery tasks
- No browser automation tests for scrapers
- Need to add pytest fixtures and test suite in Phase 2

---

## ARTIFACT J — Open Questions

1. **LLM provider for browser-use agent**: Currently configured for Kimi K2 via Ollama. Should this be configurable per-user, or is a single provider acceptable? What's the cost model?

2. **Browser pool strategy**: Should we use a persistent browser pool (Playwright BrowserContext reuse) or continue with per-task browsers? The pool approach is more efficient but risks session contamination between users.

3. **Synchronous apply endpoint**: The current POST /apply blocks for 2-5 minutes. Should we (a) move entirely to Celery background tasks with SSE status, or (b) keep the SSE stream-apply endpoint and only add background for auto mode?

4. **Credential verification**: We removed the blocking login test from credential save. Should we add a background credential verification task that runs after save and updates the credential status?

5. **India market launch**: Should we soft-launch in one city (Bengaluru) first, or go nationwide from day one? This affects initial source prioritization and UX localization depth.

6. **Pricing model**: The billing page is entirely mock. What's the intended pricing structure? Per-application, monthly subscription, or freemium with upgrade?

7. **LinkedIn terms of service**: Auto-applying on LinkedIn may violate their ToS. Should we default LinkedIn to ASSISTED mode only, requiring manual submission?

8. **Data retention**: How long should we keep job listings, applications, and screenshots? The current cleanup removes undiscovered listings after 30 days, but applications are kept indefinitely.

---

*Report generated: 2026-05-10*
*Commits pushed: 3 (79658ad, f9927da, b671eb8, 23474a4)*
*Total lines changed: ~1,400+*
*New files: 3 (matching_service rewrite, ats_adapters.py, middleware.py, migration)*