import time

import redis.asyncio as aioredis
from fastapi import APIRouter
from sqlalchemy import text

from app.config import settings
from app.database import engine

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/")
async def health_basic():
    return {"status": "ok", "version": "1.0.0", "timestamp": time.time()}


@router.get("/detailed")
async def health_detailed():
    checks = {}

    # DB check
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)[:50]}"

    # Redis check
    try:
        r = aioredis.from_url(settings.REDIS_URL)
        await r.ping()
        await r.close()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {str(e)[:50]}"

    all_ok = all(v == "ok" for v in checks.values())
    return {
        "status": "healthy" if all_ok else "degraded",
        "checks": checks,
        "timestamp": time.time(),
    }
