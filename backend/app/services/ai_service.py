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
