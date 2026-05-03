from __future__ import annotations

import uuid
from datetime import datetime, timezone

import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User

security = HTTPBearer()

_redis: aioredis.Redis | None = None


async def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    user_id: str | None = payload.get("sub")
    token_type: str | None = payload.get("type")
    if user_id is None or token_type != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


class RateLimiter:
    """Redis sliding-window rate limiter: per-user hour and day limits."""

    def __init__(self, max_per_hour: int = 20, max_per_day: int = 100):
        self.max_per_hour = max_per_hour
        self.max_per_day = max_per_day

    async def check(self, user_id: uuid.UUID) -> None:
        r = await _get_redis()
        now = datetime.now(timezone.utc)
        hour_key = f"rl:{user_id}:hour:{now.strftime('%Y%m%d%H')}"
        day_key = f"rl:{user_id}:day:{now.strftime('%Y%m%d')}"

        hour_count = await r.get(hour_key)
        day_count = await r.get(day_key)

        if hour_count and int(hour_count) >= self.max_per_hour:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: max {self.max_per_hour} applications per hour",
            )
        if day_count and int(day_count) >= self.max_per_day:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: max {self.max_per_day} applications per day",
            )

    async def increment(self, user_id: uuid.UUID) -> None:
        r = await _get_redis()
        now = datetime.now(timezone.utc)
        hour_key = f"rl:{user_id}:hour:{now.strftime('%Y%m%d%H')}"
        day_key = f"rl:{user_id}:day:{now.strftime('%Y%m%d')}"

        pipe = r.pipeline()
        pipe.incr(hour_key)
        pipe.expire(hour_key, 3600)
        pipe.incr(day_key)
        pipe.expire(day_key, 86400)
        await pipe.execute()


rate_limiter = RateLimiter(
    max_per_hour=settings.MAX_APPLICATIONS_PER_HOUR,
    max_per_day=settings.MAX_APPLICATIONS_PER_DAY,
)
