"""Shared Redis client with lazy initialization."""

import redis.asyncio as aioredis

from app.config import settings

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Return a shared Redis client, creating it lazily on first call."""
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=20,
        )
    return _redis
