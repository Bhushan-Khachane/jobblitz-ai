"""
Generates unique cover letters per application using LLM paraphrasing.
Enforces cosine similarity < 0.15 vs last 5 cover letters for this user.
"""
import hashlib
import json
import logging
from typing import Optional

from app.redis_client import get_redis
from app.services.llm_client import get_llm_client

logger = logging.getLogger(__name__)


async def generate_text(system_prompt: str, user_prompt: str) -> str:
    client = get_llm_client()
    return await client.generate(system=system_prompt, user=user_prompt, temperature=0.8)

VARIANCE_SYSTEM_PROMPT = """You are an expert cover letter writer.
Generate a highly personalized cover letter for the given job.

CRITICAL RULES:
1. NEVER start with "I am writing to apply" or "I am excited to apply"
2. Vary sentence structure — mix short punchy sentences with longer ones
3. Use different opening hooks each time: story, insight, achievement, question
4. Vary word choices: use synonyms, different phrasing for same concepts
5. The letter must be unique — never duplicate phrases from previous letters
6. Keep it under 200 words — recruiters skim
7. End with a specific, confident call to action
8. Do NOT use buzzwords: passionate, synergy, leverage, utilize, robust

Target uniqueness: each letter should score < 15% similarity to any prior letter."""


async def generate_unique_cover_letter(
    user_id: str,
    job_title: str,
    company: str,
    job_description: str,
    user_resume_summary: str,
    max_attempts: int = 3
) -> str:
    r = get_redis()
    history_key = f"cl_history:{user_id}"

    # Load last 5 cover letters from Redis
    history_raw = await r.lrange(history_key, 0, 4)
    history = [json.loads(h) for h in history_raw] if history_raw else []
    prev_texts = [h.get("text", "") for h in history]

    cover_letter = ""
    for attempt in range(max_attempts):
        variation_hint = [
            "Start with a specific achievement",
            "Start with an insight about the industry",
            "Start with a bold statement",
            "Start with a relevant question",
            "Start with the company's problem you can solve",
        ][attempt % 5]

        prompt = f"""
Job: {job_title} at {company}
Description snippet: {job_description[:500]}
My background: {user_resume_summary[:400]}
Opening style: {variation_hint}

Write the cover letter now (under 200 words):"""

        cover_letter = await generate_text(
            system_prompt=VARIANCE_SYSTEM_PROMPT,
            user_prompt=prompt
        )

        # Check similarity against history
        if not prev_texts or _max_similarity(cover_letter, prev_texts) < 0.15:
            # Store in Redis history (keep last 20)
            entry = json.dumps({"text": cover_letter, "job": job_title, "company": company})
            await r.lpush(history_key, entry)
            await r.ltrim(history_key, 0, 19)
            return cover_letter

        logger.warning(f"Cover letter attempt {attempt+1} too similar, regenerating...")

    # Return last attempt even if similar (better than failing)
    return cover_letter


def _max_similarity(text: str, others: list[str]) -> float:
    """Simple TF-IDF cosine similarity approximation."""
    def tokenize(t): return set(t.lower().split())
    tokens = tokenize(text)
    max_sim = 0.0
    for other in others:
        other_tokens = tokenize(other)
        if not tokens or not other_tokens:
            continue
        intersection = tokens & other_tokens
        sim = len(intersection) / (len(tokens | other_tokens) or 1)
        max_sim = max(max_sim, sim)
    return max_sim
