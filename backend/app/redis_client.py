"""Shared Redis client with lazy initialization."""

import os

import redis.asyncio as aioredis

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Return a shared Redis client, creating it lazily on first call."""
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            os.getenv("REDIS_URL", "redis://redis:6379/0"),
            decode_responses=True,
            max_connections=20,
        )
    return _redis
