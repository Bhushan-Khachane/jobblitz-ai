"""Per-user application rate enforcer for Naukri and other portals."""

import os
from datetime import datetime, timezone

import redis.asyncio as aioredis

redis = aioredis.from_url(os.getenv("REDIS_URL", "redis://redis:6379"))

HOURLY_LIMIT = 10  # max applications per user per hour per portal
DAILY_LIMIT = 50  # max applications per user per day per portal


def _hour_key(user_id: str, portal: str) -> str:
    now = datetime.now(timezone.utc)
    return f"rate:{user_id}:{portal}:hour:{now.strftime('%Y%m%d%H')}"


def _day_key(user_id: str, portal: str) -> str:
    now = datetime.now(timezone.utc)
    return f"rate:{user_id}:{portal}:day:{now.strftime('%Y%m%d')}"


async def check_apply_rate(user_id: str, portal: str) -> dict:
    hour_key = _hour_key(str(user_id), portal)
    day_key = _day_key(str(user_id), portal)

    hour_count = int(await redis.get(hour_key) or 0)
    day_count = int(await redis.get(day_key) or 0)

    if hour_count >= HOURLY_LIMIT:
        return {"allowed": False, "reason": f"Hourly limit reached ({HOURLY_LIMIT}/hour). Try again next hour."}
    if day_count >= DAILY_LIMIT:
        return {"allowed": False, "reason": f"Daily limit reached ({DAILY_LIMIT}/day). Try again tomorrow."}

    return {"allowed": True, "hour_count": hour_count, "day_count": day_count}


async def increment_apply_count(user_id: str, portal: str):
    hour_key = _hour_key(str(user_id), portal)
    day_key = _day_key(str(user_id), portal)

    pipe = redis.pipeline()
    pipe.incr(hour_key)
    pipe.expire(hour_key, 3600)
    pipe.incr(day_key)
    pipe.expire(day_key, 86400)
    await pipe.execute()


async def get_rate_status(user_id: str, portal: str) -> dict:
    hour_key = _hour_key(str(user_id), portal)
    day_key = _day_key(str(user_id), portal)

    hour_count = int(await redis.get(hour_key) or 0)
    day_count = int(await redis.get(day_key) or 0)

    return {
        "portal": portal,
        "hourly_used": hour_count,
        "hourly_limit": HOURLY_LIMIT,
        "daily_used": day_count,
        "daily_limit": DAILY_LIMIT,
        "hourly_remaining": max(0, HOURLY_LIMIT - hour_count),
        "daily_remaining": max(0, DAILY_LIMIT - day_count),
    }
