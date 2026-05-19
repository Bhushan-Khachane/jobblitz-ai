import time

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from sqlalchemy import text

from app.config import settings
from app.database import engine
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/")
async def health_basic():
    """Basic liveness check — no auth required."""
    queue = "ok"
    try:
        r = aioredis.from_url(settings.REDIS_URL)
        await r.ping()
        await r.aclose()
    except Exception:
        queue = "unavailable"
    return {"status": "ok", "version": settings.VERSION, "queue": queue, "timestamp": time.time()}


@router.get("/ready")
async def readiness_check():
    """Readiness check — returns 503 if any critical dependency is down."""
    checks = {}
    status_code = 200

    # DB check
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)[:100]}"
        status_code = 503

    # Redis check
    try:
        r = aioredis.from_url(settings.REDIS_URL)
        await r.ping()
        await r.close()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {str(e)[:100]}"
        status_code = 503

    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if status_code == 200 else "not_ready",
            "checks": checks,
            "timestamp": time.time(),
        },
    )


@router.get("/detailed")
async def health_detailed(user: User = Depends(get_current_user)):
    """Detailed health check — requires auth. Shows all service statuses."""
    checks = {}

    # DB check
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT count(*) FROM job_listings"))
            count = result.scalar()
        checks["database"] = {"status": "ok", "job_listings_count": count}
    except Exception as e:
        checks["database"] = {"status": "error", "detail": str(e)[:200]}

    # Redis check
    try:
        r = aioredis.from_url(settings.REDIS_URL)
        info = await r.info("server")
        await r.close()
        checks["redis"] = {"status": "ok", "version": info.get("redis_version", "unknown")}
    except Exception as e:
        checks["redis"] = {"status": "error", "detail": str(e)[:200]}

    all_ok = all(
        v.get("status") == "ok" if isinstance(v, dict) else v == "ok"
        for v in checks.values()
    )
    return {
        "status": "healthy" if all_ok else "degraded",
        "checks": checks,
        "timestamp": time.time(),
    }


@router.get("/browser-worker")
async def health_browser_worker():
    """Health check for the browser-worker service."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("http://browser-worker:8002/health")
            if resp.status_code == 200:
                return {"status": "ok", "detail": resp.json()}
    except Exception as e:
        return {"status": "unreachable", "detail": str(e)[:200]}


@router.get("/adk-orchestrator")
async def health_adk_orchestrator():
    """Health check for the ADK orchestrator service."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("http://adk-orchestrator:8001/health")
            if resp.status_code == 200:
                return {"status": "ok", "detail": resp.json()}
    except Exception as e:
        return {"status": "unreachable", "detail": str(e)[:200]}