from __future__ import annotations

from openai import AsyncOpenAI

from app.config import settings

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.OPENROUTER_API_KEY,
            base_url=settings.OPENROUTER_BASE_URL,
        )
    return _client


RESUME_TAILOR_SYSTEM = (
    "You are an expert resume writer. Given a resume and job description, rewrite the resume "
    "to maximize ATS match. Keep professional format. Return only the rewritten resume text."
)

COVER_LETTER_SYSTEM = (
    "Write a concise 250-word cover letter given job description, company name, and candidate "
    "profile. Professional tone. Return only the letter text."
)

QUESTION_ANSWER_SYSTEM = (
    "Given a job application form question and candidate profile data, generate a professional "
    "answer. Be concise. Return only the answer."
)

EXTRACT_RESUME_PROFILE_SYSTEM = (
    "You are an expert resume parser. Extract structured information from the resume text below. "
    "Return ONLY a valid JSON object with these keys:\n"
    '- "skills": list of technical and soft skills (e.g., ["Python", "React", "Leadership"])\n'
    '- "job_titles": list of job titles the candidate has held or targets (e.g., ["Fullstack Developer", "Data Engineer"])\n'
    '- "headline": one-line professional headline\n'
    '- "summary": 2-3 sentence professional summary\n'
    '- "experience_years": integer total years of experience\n'
    '- "education": list of degrees (e.g., ["B.Tech Computer Science"])\n'
    '- "experience": list of recent roles with company and duration\n'
    "Do NOT wrap in markdown code blocks. Return raw JSON only."
)

MATCH_JOB_RESUME_SYSTEM = (
    "You are a career-matching expert. Given a resume and a job description, rate how well the "
    "candidate fits the job on a scale of 0 to 100. Consider skills overlap, experience level, "
    "and job title relevance. Return ONLY an integer between 0 and 100 with no explanation."
)


async def _chat(system: str, user: str) -> str:
    client = _get_client()
    response = await client.chat.completions.create(
        model=settings.OPENROUTER_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.7,
        max_tokens=2048,
    )
    return response.choices[0].message.content or ""


async def resume_tailor(resume_text: str, job_description: str) -> str:
    user_msg = f"### RESUME\n{resume_text}\n\n### JOB DESCRIPTION\n{job_description}"
    return await _chat(RESUME_TAILOR_SYSTEM, user_msg)


async def cover_letter_generate(
    job_description: str,
    company_name: str,
    candidate_profile: str,
    job_title: str | None = None,
) -> str:
    parts = [
        f"### JOB DESCRIPTION\n{job_description}",
        f"### COMPANY\n{company_name}",
        f"### CANDIDATE PROFILE\n{candidate_profile}",
    ]
    if job_title:
        parts.insert(1, f"### JOB TITLE\n{job_title}")
    return await _chat(COVER_LETTER_SYSTEM, "\n\n".join(parts))


async def answer_question(question: str, candidate_profile: str) -> str:
    user_msg = f"### QUESTION\n{question}\n\n### CANDIDATE PROFILE\n{candidate_profile}"
    return await _chat(QUESTION_ANSWER_SYSTEM, user_msg)


import json
import logging

logger = logging.getLogger(__name__)


async def extract_resume_profile(resume_text: str) -> dict:
    """Use LLM to extract structured profile data from raw resume text."""
    user_msg = f"### RESUME\n{resume_text}\n\nExtract the structured profile."
    raw = await _chat(EXTRACT_RESUME_PROFILE_SYSTEM, user_msg)

    # Strip markdown code fences if present
    raw = raw.strip()
    if raw.startswith("```json"):
        raw = raw[7:]
    if raw.startswith("```"):
        raw = raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3]
    raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse LLM resume extraction response: {e}. Raw: {raw[:500]}")
        return {}

    # Normalize fields
    result = {
        "skills": _to_str_list(data.get("skills")),
        "job_titles": _to_str_list(data.get("job_titles")),
        "headline": _to_str(data.get("headline")),
        "summary": _to_str(data.get("summary")),
        "experience_years": _to_int(data.get("experience_years")),
        "education": data.get("education") if isinstance(data.get("education"), list) else [],
        "experience": data.get("experience") if isinstance(data.get("experience"), list) else [],
    }
    return result


async def match_job_to_resume(job_description: str, resume_text: str) -> float:
    """Return match score 0.0-1.0 using LLM."""
    user_msg = f"### RESUME\n{resume_text}\n\n### JOB DESCRIPTION\n{job_description}"
    raw = await _chat(MATCH_JOB_RESUME_SYSTEM, user_msg)
    raw = raw.strip()
    try:
        score = int(raw)
        return max(0.0, min(1.0, score / 100.0))
    except (ValueError, TypeError):
        logger.warning(f"Failed to parse match score from LLM: {raw}")
        return 0.0


def _to_str_list(val) -> list[str]:
    if isinstance(val, list):
        return [str(v).strip() for v in val if v]
    if isinstance(val, str):
        return [v.strip() for v in val.split(",") if v.strip()]
    return []


def _to_str(val) -> str:
    return str(val).strip() if val else ""


def _to_int(val) -> int | None:
    try:
        return int(val)
    except (ValueError, TypeError):
        return None
