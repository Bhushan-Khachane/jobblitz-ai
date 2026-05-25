import hashlib
import json
import os
from typing import Dict

import redis.asyncio as redis

from config.llm import async_generate

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")


async def _get_redis():
    return redis.from_url(REDIS_URL, decode_responses=True)


async def generate(user_id: str, job: Dict, profile: Dict) -> Dict:
    """Generate a cover letter and answers for a job application.

    Uses one LLM call via async_generate(). Caches results in Redis
    for 7 days with key cover_letter:{user_id}:{job_url_hash}.
    """
    job_url = job.get("url", job.get("apply_url", ""))
    url_hash = hashlib.sha256(job_url.encode()).hexdigest()[:16]
    cache_key = f"cover_letter:{user_id}:{url_hash}"

    r = await _get_redis()
    try:
        cached = await r.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    system = (
        "You are an expert career coach writing tailored cover letters for Indian job seekers. "
        "Return ONLY valid JSON with no markdown formatting."
    )

    prompt = f"""Write a concise, professional cover letter (120–180 words) for the following job and candidate.

Job Title: {job.get("title", "")}
Company: {job.get("company", "")}
Job Description: {job.get("description", "")[:800]}

Candidate Profile:
- Name: {profile.get("full_name", profile.get("name", ""))}
- Headline: {profile.get("headline", "")}
- Skills: {', '.join(profile.get('skills', []) or [])}
- Experience: {json.dumps(profile.get('experience', {}))}
- Summary: {profile.get('summary', '')}

Also provide brief answers (1–2 sentences each) to common screening questions:
1. why_this_role — why this specific role/company
2. key_strength — top relevant strength with example
3. notice_period — notice period (e.g., 30 days, 60 days, immediate)
4. expected_salary — expected CTC in LPA (e.g., 12–15 LPA)

Return valid JSON exactly in this shape:
{{
  "cover_letter": "...",
  "answers": {{
    "why_this_role": "...",
    "key_strength": "...",
    "notice_period": "...",
    "expected_salary": "..."
  }}
}}
"""

    raw = await async_generate(prompt, system=system, use_pro=True)

    # Extract JSON from possible markdown blocks
    cleaned = raw
    if "```json" in cleaned:
        cleaned = cleaned.split("```json")[1].split("```")[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```")[1].split("```")[0].strip()

    try:
        result = json.loads(cleaned)
    except Exception:
        # Fallback: construct from raw text
        result = {
            "cover_letter": raw[:1200],
            "answers": {
                "why_this_role": "",
                "key_strength": "",
                "notice_period": profile.get("notice_period_days", "30") + " days",
                "expected_salary": "",
            }
        }

    # Cache for 7 days
    try:
        await r.setex(cache_key, 60 * 60 * 24 * 7, json.dumps(result))
    except Exception:
        pass

    return result
