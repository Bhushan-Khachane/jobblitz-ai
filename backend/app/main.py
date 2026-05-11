from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.gzip import GZipMiddleware

from app.config import settings
from app.database import engine
from app.middleware import RequestLogMiddleware
from app.routers import (
    analytics,
    applications,
    auth,
    cover_letters,
    credentials,
    health,
    job_listings,
    job_searches,
    resumes,
    users,
)
from app.api.routers import login_sessions


async def check_db_ping() -> bool:
    """Check if database is reachable."""
    try:
        from sqlalchemy import text
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


async def check_redis_ping() -> bool:
    """Check if Redis is reachable."""
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL)
        result = await r.ping()
        await r.aclose()
        return result
    except Exception:
        return False


async def check_browser_pool() -> int:
    """Check browser pool availability."""
    try:
        from app.services.browser_pool import browser_pool
        return browser_pool.available_count()
    except Exception:
        return -1


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.SCREENSHOT_DIR).mkdir(parents=True, exist_ok=True)

    # Initialize browser pool
    from app.services.browser_pool import browser_pool
    await browser_pool.initialize()

    # Setup OpenTelemetry
    from app.telemetry import setup_telemetry
    setup_telemetry(app)

    yield

    # Shutdown
    await browser_pool.shutdown()
    await engine.dispose()


app = FastAPI(
    title="JobBlitz AI",
    description="Automated job application platform for Indian job seekers",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Security middleware (outermost first) ────────────────────────────────────

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "*.jobblitz.ai", ".localhost"])
app.add_middleware(RequestLogMiddleware)

# ── CORS ─────────────────────────────────────────────────────────────────────

ALLOWED_ORIGINS = settings.ALLOWED_ORIGINS.split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ── Health endpoint ──────────────────────────────────────────────────────────


@app.get("/health")
async def health_check():
    """Comprehensive health check for all dependencies."""
    db_ok = await check_db_ping()
    redis_ok = await check_redis_ping()
    browser_pool_count = await check_browser_pool()

    return {
        "status": "ok" if db_ok and redis_ok else "degraded",
        "db": "ok" if db_ok else "unreachable",
        "redis": "ok" if redis_ok else "unreachable",
        "browser_pool": browser_pool_count,
        "version": settings.VERSION if hasattr(settings, "VERSION") else "1.0.0",
    }


# ── Routers ──────────────────────────────────────────────────────────────────

app.include_router(health.router)  # no /api/v1 prefix for health
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(resumes.router, prefix="/api/v1")
app.include_router(credentials.router, prefix="/api/v1")
app.include_router(job_searches.router, prefix="/api/v1")
app.include_router(job_listings.router, prefix="/api/v1")
app.include_router(applications.router, prefix="/api/v1")
app.include_router(cover_letters.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(login_sessions.router, prefix="/api/v1")