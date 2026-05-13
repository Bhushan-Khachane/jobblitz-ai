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


# ── Internal service auth (ADK orchestrator, browser-worker) ──────────────────

INTERNAL_API_KEY = getattr(settings, "INTERNAL_API_KEY", "jobblitz-internal-dev-key")


from fastapi import Header as FastAPIHeader

optional_security = HTTPBearer(auto_error=False)

async def get_current_user_or_service(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
    x_internal_api_key: str | None = FastAPIHeader(None, alias="x-internal-api-key"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Accept either a valid user JWT or an internal service API key.
    For service-to-service calls, pass X-Internal-Api-Key header.
    """
    # Check internal API key first (for service-to-service)
    if x_internal_api_key == INTERNAL_API_KEY:
        # Return a dummy system user for internal calls
        result = await db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if user:
            return user
    # Fall back to JWT auth
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing auth credentials")
    return await get_current_user(credentials, db)


class RateLimiter:
    """Redis sliding-window rate limiter: per-user hour and day limits.
    Uses atomic Lua script for check+increment to prevent race conditions.
    """

    def __init__(self, max_per_hour: int = 20, max_per_day: int = 100):
        self.max_per_hour = max_per_hour
        self.max_per_day = max_per_day

    async def check(self, user_id: uuid.UUID) -> None:
        """Check rate limit without incrementing. Returns or raises 429."""
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

    async def check_and_increment(self, user_id: uuid.UUID) -> None:
        """Atomically check rate limit and increment counters using Lua script.
        This prevents race conditions where concurrent requests both pass the check
        before either increments.
        """
        r = await _get_redis()
        now = datetime.now(timezone.utc)
        hour_key = f"rl:{user_id}:hour:{now.strftime('%Y%m%d%H')}"
        day_key = f"rl:{user_id}:day:{now.strftime('%Y%m%d')}"

        # Atomic check-and-increment via Lua script
        lua_script = """
        local hour_key = KEYS[1]
        local day_key = KEYS[2]
        local max_hour = tonumber(ARGV[1])
        local max_day = tonumber(ARGV[2])
        local hour_ttl = tonumber(ARGV[3])
        local day_ttl = tonumber(ARGV[4])

        local hour_count = tonumber(redis.call('GET', hour_key) or '0')
        local day_count = tonumber(redis.call('GET', day_key) or '0')

        if hour_count >= max_hour then
            return {0, hour_count, day_count, 'hour'}
        end
        if day_count >= max_day then
            return {0, hour_count, day_count, 'day'}
        end

        -- Both checks passed, increment atomically
        redis.call('INCR', hour_key)
        redis.call('EXPIRE', hour_key, hour_ttl)
        redis.call('INCR', day_key)
        redis.call('EXPIRE', day_key, day_ttl)

        return {1, hour_count + 1, day_count + 1, 'ok'}
        """

        result = await r.eval(
            lua_script, 2,
            hour_key, day_key,
            str(self.max_per_hour), str(self.max_per_day),
            str(3600), str(86400),
        )

        allowed = result[0]
        limit_type = result[3]

        if not allowed:
            if limit_type == "hour":
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded: max {self.max_per_hour} applications per hour",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded: max {self.max_per_day} applications per day",
                )

    async def increment(self, user_id: uuid.UUID) -> None:
        """Non-atomic increment for cases where check was already done separately."""
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
