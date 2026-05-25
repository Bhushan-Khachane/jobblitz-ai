"""LLM-based salary estimation for jobs without listed salary.

Caches estimates in Redis by (title + company_tier + city) with TTL=7 days.
"""

from __future__ import annotations

import hashlib
import json
import logging

from app.services.llm_client import get_llm_client
from app.config import settings

logger = logging.getLogger(__name__)

SALARY_ESTIMATE_SYSTEM = (
    "You are a compensation analyst specializing in the Indian tech job market (2026). "
    "Given job details, estimate the salary range in Indian LPA (Lakhs Per Annum). "
    "Return ONLY a valid JSON object with these keys:\n"
    '- "min_lpa": integer\n'
    '- "max_lpa": integer\n'
    '- "currency": "INR"\n'
    '- "confidence": "high" | "medium" | "low"\n'
    "Do NOT wrap in markdown. Return raw JSON only."
)

_COMPANY_TIER_MAP = {
    "faang": {"google", "amazon", "microsoft", "meta", "facebook", "apple", "netflix", "alphabet"},
    "top_tier": {"flipkart", "swiggy", "zomato", "ola", "uber", " CRED", "phonepe", "paytm", "razorpay", "freshworks", "zerodha", "postman", "chargebee", "freshworks", "hasura", "postman", "browserstack", "leadiq"},
    "mnc": {"accenture", "tcs", "infosys", "wipro", "cognizant", "capgemini", "ibm", "deloitte", "pwc", "ey", "kpmg", "oracle", "sap", "dell", "hp", "intel", "qualcomm", "broadcom"},
    "startup": set(),
}


def _company_tier(company: str) -> str:
    c = company.lower().strip()
    for tier, companies in _COMPANY_TIER_MAP.items():
        if c in companies or any(c in comp or comp in c for comp in companies):
            return tier
    return "startup"


def _cache_key(title: str, company: str, city: str) -> str:
    tier = _company_tier(company)
    raw = f"{title.lower().strip()}|{tier}|{city.lower().strip()}"
    return f"salary_est:{hashlib.md5(raw.encode()).hexdigest()}"


async def _redis_get(key: str) -> dict | None:
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        val = await r.get(key)
        if val:
            return json.loads(val)
    except Exception:
        pass
    return None


async def _redis_set(key: str, data: dict, ttl: int = 604800) -> None:  # 7 days
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await r.setex(key, ttl, json.dumps(data))
    except Exception:
        pass


async def estimate_salary(
    title: str,
    company: str,
    location: str,
    experience_required: str,
    skills: list[str],
) -> dict:
    """
    Estimate salary for a job. Uses cache first, then LLM fallback.
    Returns {"min_lpa", "max_lpa", "currency", "confidence"}.
    """
    city = (location or "India").split(",")[0].strip()
    key = _cache_key(title, company, city)

    cached = await _redis_get(key)
    if cached:
        return cached

    client = get_llm_client()
    prompt = (
        f"Job Title: {title}\n"
        f"Company: {company}\n"
        f"Location: {location or 'India'}\n"
        f"Experience Required: {experience_required or 'Not specified'}\n"
        f"Key Skills: {', '.join(skills[:10]) if skills else 'Not specified'}\n"
        f"Company Size Tier: {_company_tier(company)}"
    )

    try:
        resp = await client.generate_structured(SALARY_ESTIMATE_SYSTEM, prompt)
        result = {
            "min_lpa": int(resp.get("min_lpa", 0)),
            "max_lpa": int(resp.get("max_lpa", 0)),
            "currency": resp.get("currency", "INR"),
            "confidence": resp.get("confidence", "medium"),
        }
        await _redis_set(key, result)
        return result
    except Exception as e:
        logger.warning(f"Salary estimation failed: {e}")
        # Fallback: rough heuristic based on experience and company tier
        tier = _company_tier(company)
        base_ranges = {
            "faang": (30, 60),
            "top_tier": (20, 45),
            "mnc": (12, 35),
            "startup": (8, 25),
        }
        mn, mx = base_ranges.get(tier, (10, 30))
        # Adjust for experience
        import re
        m = re.search(r"(\d+)", experience_required or "")
        if m:
            yrs = int(m.group(1))
            mn = max(6, mn + (yrs - 2) * 3)
            mx = max(10, mx + (yrs - 2) * 4)
        return {"min_lpa": mn, "max_lpa": mx, "currency": "INR", "confidence": "low"}
