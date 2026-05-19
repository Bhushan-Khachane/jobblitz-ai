"""
Enforces per-user, per-platform apply rate limits in Redis.
These limits CANNOT be overridden by user settings — they are safety floors.
"""
import math
import random
import time
from datetime import datetime, timezone

from app.redis_client import get_redis

# Conservative safe limits — tuned to be indistinguishable from human behavior
SAFE_LIMITS = {
    "linkedin":    {"daily": 8,  "hourly": 2,  "min_gap_sec": 300,  "name": "LinkedIn"},
    "naukri":      {"daily": 15, "hourly": 4,  "min_gap_sec": 180,  "name": "Naukri"},
    "indeed":      {"daily": 20, "hourly": 5,  "min_gap_sec": 120,  "name": "Indeed"},
    "internshala": {"daily": 25, "hourly": 6,  "min_gap_sec":  60,  "name": "Internshala"},
    "shine":       {"daily": 20, "hourly": 5,  "min_gap_sec":  90,  "name": "Shine"},
    "unstop":      {"daily": 25, "hourly": 6,  "min_gap_sec":  60,  "name": "Unstop"},
}


def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _hour_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d-%H")


def human_delay_seconds(min_s: float = 45, max_s: float = 180) -> float:
    """Log-normal delay — matches real human think time between applications."""
    mu = math.log((min_s + max_s) / 2)
    sigma = 0.35
    delay = math.exp(random.gauss(mu, sigma))
    return max(min_s, min(delay, max_s))


def is_working_hour() -> bool:
    """Only allow applies between 8am-10pm IST (no midnight robot behaviour)."""
    hour = datetime.now(timezone.utc).hour + 5  # rough IST offset
    return 8 <= (hour % 24) <= 22


async def can_apply(user_id: str, platform: str) -> tuple[bool, str]:
    """Check if this user can apply on this platform right now."""
    if not is_working_hour():
        return False, "Outside working hours (applies only 8am-10pm)"

    lim = SAFE_LIMITS.get(platform.lower(), SAFE_LIMITS["naukri"])
    r = get_redis()

    daily_key  = f"vel:daily:{user_id}:{platform}:{_today_str()}"
    hourly_key = f"vel:hourly:{user_id}:{platform}:{_hour_str()}"
    last_key   = f"vel:last:{user_id}:{platform}"

    daily  = int((await r.get(daily_key))  or 0)
    hourly = int((await r.get(hourly_key)) or 0)
    last_t = float((await r.get(last_key)) or 0)
    gap    = time.time() - last_t

    if daily >= lim["daily"]:
        return False, f"{lim['name']} daily limit ({lim['daily']}/day) reached. Resets midnight."
    if hourly >= lim["hourly"]:
        return False, f"{lim['name']} hourly limit ({lim['hourly']}/hr) reached."
    if gap < lim["min_gap_sec"]:
        wait = int(lim["min_gap_sec"] - gap)
        return False, f"Too fast — wait {wait}s before next {lim['name']} apply."

    return True, "ok"


async def record_apply(user_id: str, platform: str):
    """Record a successful apply dispatch in Redis."""
    r = get_redis()
    pipe = r.pipeline()

    daily_key  = f"vel:daily:{user_id}:{platform}:{_today_str()}"
    hourly_key = f"vel:hourly:{user_id}:{platform}:{_hour_str()}"
    last_key   = f"vel:last:{user_id}:{platform}"

    pipe.incr(daily_key)
    pipe.expire(daily_key, 86400)
    pipe.incr(hourly_key)
    pipe.expire(hourly_key, 3600)
    pipe.set(last_key, time.time(), ex=86400)
    await pipe.execute()


async def get_apply_stats(user_id: str) -> dict:
    """Return current daily counts per platform for dashboard display."""
    r = get_redis()
    stats = {}
    for platform, lim in SAFE_LIMITS.items():
        key = f"vel:daily:{user_id}:{platform}:{_today_str()}"
        count = int((await r.get(key)) or 0)
        stats[platform] = {"used": count, "limit": lim["daily"], "remaining": lim["daily"] - count}
    return stats
