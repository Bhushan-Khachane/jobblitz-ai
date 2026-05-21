from __future__ import annotations

import logging

from app.services.llm_client import get_llm_client

logger = logging.getLogger(__name__)

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
    '- "education": list of degrees with institution and year (e.g., [{"degree": "B.Tech Computer Science", "institution": "IIT Bombay", "year": "2018"}])\n'
    '- "experience": list of roles with company, title, duration, and description '
    '(e.g., [{"company": "Google", "title": "Senior Engineer", "duration": "2020-2023", "description": "Built ML pipelines"}])\n'
    '- "certifications": list of certifications with issuer and year '
    '(e.g., [{"name": "AWS Solutions Architect", "issuer": "Amazon", "year": "2022"}])\n'
    '- "languages": list of languages known (e.g., ["English", "Hindi", "Marathi"])\n'
    '- "current_ctc_lpa": number — current annual CTC in lakhs (e.g., 12.5)\n'
    '- "current_fixed_lpa": number — current fixed component in lakhs\n'
    '- "current_variable_lpa": number — current variable/bonus component in lakhs\n'
    '- "portfolio_url": string — portfolio or personal website URL\n'
    '- "linkedin_url": string — LinkedIn profile URL\n'
    '- "github_url": string — GitHub profile URL\n'
    "Always return arrays (even empty) for skills, job_titles, education, experience, certifications, and languages. "
    "Return null for any field not found in the resume. "
    "Do NOT wrap in markdown code blocks. Return raw JSON only."
)

GENERATE_PROFESSIONAL_SUMMARY_SYSTEM = (
    "You are an elite career strategist and resume writer specializing in the Indian job market. "
    "Given a candidate's profile data and resume text, write a compelling, keyword-rich professional summary "
    "that maximizes visibility on job portals (LinkedIn, Naukri, Indeed) and ATS systems.\n\n"
    "Requirements:\n"
    "- 4-6 sentences, 250-350 words total\n"
    "- Lead with strongest differentiator (years of experience + core expertise)\n"
    "- Weave in key technical skills naturally (don't just list them)\n"
    "- Mention top achievements with metrics if available\n"
    "- Include target role alignment and career trajectory\n"
    "- Optimize for recruiter search keywords relevant to Indian market\n"
    "- Tone: confident, professional, action-oriented\n"
    "- Return ONLY the summary text. No markdown, no labels, no explanation."
)

MATCH_JOB_RESUME_SYSTEM = (
    "You are a career-matching expert. Given a resume and a job description, rate how well the "
    "candidate fits the job on a scale of 0 to 100. Consider skills overlap, experience level, "
    "and job title relevance. Return ONLY an integer between 0 and 100 with no explanation."
)


async def _chat(system: str, user: str) -> str:
    client = get_llm_client()
    return await client.generate(system=system, user=user)


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


async def extract_resume_profile(resume_text: str) -> dict:
    """Use LLM to extract structured profile data from raw resume text."""
    client = get_llm_client()
    user_msg = f"### RESUME\n{resume_text}\n\nExtract the structured profile."
    return await client.generate_structured(EXTRACT_RESUME_PROFILE_SYSTEM, user_msg)


async def generate_professional_summary(profile_data: dict, resume_text: str | None = None) -> str:
    """Generate an AI-crafted professional summary from profile + resume data."""
    parts = ["### CANDIDATE PROFILE\n" + str(profile_data)]
    if resume_text:
        parts.append(f"### RESUME TEXT\n{resume_text}")
    return await _chat(GENERATE_PROFESSIONAL_SUMMARY_SYSTEM, "\n\n".join(parts))


async def match_job_to_resume_llm(job_description: str, resume_text: str) -> float:
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