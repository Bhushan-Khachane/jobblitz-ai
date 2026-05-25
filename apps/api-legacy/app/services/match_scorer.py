"""Multi-factor job-candidate matching scorer.

Implements 5 scorers:
1. skill_score — Jaccard similarity between profile skills and job skills
2. experience_score — range-based scoring for years of experience
3. cert_score — certification matching
4. location_score — location preference matching
5. domain_score — semantic cosine similarity via sentence-transformers

Final score is a weighted average: 0.30*skill + 0.20*exp + 0.15*cert + 0.15*loc + 0.20*domain
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import List

import numpy as np

from app.services.llm_client import get_llm_client

logger = logging.getLogger(__name__)

EXTRACT_JOB_SKILLS_SYSTEM = (
    "Extract the required technical and soft skills from this job description. "
    "Return ONLY a JSON object with:\n"
    '- "primary_skills": list of core required skills\n'
    '- "secondary_skills": list of nice-to-have skills\n'
    '- "certifications": list of certifications mentioned\n'
    "Do NOT wrap in markdown. Return raw JSON only."
)

EXTRACT_EXPERIENCE_SYSTEM = (
    "Extract the experience range from this job posting. "
    "Return ONLY a JSON object with:\n"
    '- "min_years": integer or null\n'
    '- "max_years": integer or null\n'
    '- "raw_text": the experience text found\n'
    "Do NOT wrap in markdown. Return raw JSON only."
)

EXTRACT_CERTIFICATIONS_SYSTEM = (
    "Extract any certifications mentioned in this job description. "
    "Return ONLY a JSON array of certification names. "
    "If none, return []. Do NOT wrap in markdown."
)


def _extract_experience_regex(text: str) -> tuple[int | None, int | None]:
    """Extract min/max years from job description using regex."""
    text_lower = text.lower()
    # Patterns: "3-5 years", "3 to 5 years", "3+ years", "minimum 3 years"
    patterns = [
        r"(\d+)\s*[-–—to]+\s*(\d+)\s*years?",
        r"(\d+)\s*[-–—to]+\s*(\d+)\s*yrs?",
        r"minimum\s*(\d+)\s*years?",
        r"min\s*(\d+)\s*years?",
        r"at least\s*(\d+)\s*years?",
        r"(\d+)\+?\s*years?",
        r"(\d+)\+?\s*yrs?",
    ]
    min_years: int | None = None
    max_years: int | None = None
    for pat in patterns:
        for match in re.finditer(pat, text_lower):
            groups = match.groups()
            if len(groups) == 2:
                a, b = int(groups[0]), int(groups[1])
                min_years = min(a, b) if min_years is None else min(min_years, a, b)
                max_years = max(a, b) if max_years is None else max(max_years, a, b)
            elif len(groups) == 1:
                a = int(groups[0])
                min_years = a if min_years is None else min(min_years, a)
                max_years = max_years or a
    return min_years, max_years


@dataclass
class CandidateProfile:
    """Parsed candidate profile for scoring."""
    user_id: str
    headline: str = ""
    summary: str = ""
    core_skills: list[str] = field(default_factory=list)
    experience_years: float = 0.0
    experience_level: str = ""
    preferred_locations: list[str] = field(default_factory=list)
    open_to_remote: bool = True
    certifications: list[str] = field(default_factory=list)
    domain_expertise: str = ""
    salary_min_lpa: float | None = None
    salary_max_lpa: float | None = None
    current_ctc_lpa: float | None = None
    languages: list[str] = field(default_factory=list)
    education: list[dict] = field(default_factory=list)


@dataclass
class JobListing:
    """Job listing for scoring."""
    job_id: str
    company: str
    role: str
    location: str | None
    job_type: str | None
    description: str
    experience_required: str | ""
    salary_raw: str | None
    apply_link: str
    source_portal: str
    primary_skills: list[str] = field(default_factory=list)
    secondary_skills: list[str] = field(default_factory=list)
    certifications_required: list[str] = field(default_factory=list)
    experience_min: int | None = None
    experience_max: int | None = None


def skill_score(profile: CandidateProfile, job: JobListing) -> float:
    """
    Jaccard similarity between profile.core_skills and job skills.
    Boost by 1.1x if profile has ALL primary required skills.
    Cap at 1.0.
    """
    if not job.primary_skills and not job.secondary_skills:
        return 0.5  # neutral if no skills extracted
    if not profile.core_skills:
        return 0.0

    profile_skills = set(s.lower().strip() for s in profile.core_skills)
    job_skills = set(s.lower().strip() for s in (job.primary_skills + job.secondary_skills))

    if not job_skills:
        return 0.5

    intersection = profile_skills & job_skills
    union = profile_skills | job_skills
    jaccard = len(intersection) / len(union) if union else 0.0

    # Boost if all primary skills are matched
    primary_set = set(s.lower().strip() for s in job.primary_skills)
    if primary_set and primary_set.issubset(profile_skills):
        jaccard = min(1.0, jaccard * 1.1)

    return round(min(1.0, jaccard), 3)


def experience_score(profile: CandidateProfile, job: JobListing) -> float:
    """
    If profile.years_of_experience is within range: 1.0
    If within 1 year below minimum: 0.75
    If exceeds maximum by <= 3 years: 0.85 (overqualified penalty)
    Otherwise: 0.3
    """
    exp = profile.experience_years
    min_exp = job.experience_min
    max_exp = job.experience_max

    if min_exp is None and max_exp is None:
        return 0.7  # neutral if not specified

    # Use defaults if one is missing
    if min_exp is None:
        min_exp = 0
    if max_exp is None:
        max_exp = 30

    if min_exp <= exp <= max_exp:
        return 1.0
    if exp < min_exp and (min_exp - exp) <= 1.0:
        return 0.75
    if exp > max_exp and (exp - max_exp) <= 3.0:
        return 0.85
    return 0.3


def cert_score(profile: CandidateProfile, job: JobListing) -> float:
    """
    Check if job description mentions specific certifications.
    If profile has mentioned cert: 1.0
    If job mentions no certs: 0.8 (neutral)
    If job requires cert user lacks: 0.4
    """
    job_certs = set(c.lower().strip() for c in job.certifications_required)
    if not job_certs:
        return 0.8

    profile_certs = set(c.lower().strip() for c in profile.certifications)
    matched = job_certs & profile_certs
    missing = job_certs - profile_certs

    if not missing:
        return 1.0
    if matched:
        return 0.7  # partial match
    return 0.4


def location_score(profile: CandidateProfile, job: JobListing) -> float:
    """
    If job.location matches any of profile.preferred_locations: 1.0
    If job is Remote and profile.open_to_remote: 1.0
    If job is in same state/region: 0.7
    If job is pan-India (relocatable): 0.6
    If job requires relocation to non-preferred city: 0.3
    """
    if not job.location:
        return 0.7

    job_loc = job.location.lower().strip()

    # Remote check
    remote_keywords = {"remote", "wfh", "work from home", "anywhere", "pan india", "pan-india"}
    if any(k in job_loc for k in remote_keywords):
        if profile.open_to_remote:
            return 1.0
        return 0.6

    # Preferred location match
    for pref in profile.preferred_locations:
        if pref.lower().strip() in job_loc or job_loc in pref.lower().strip():
            return 1.0

    # Same state/region heuristic (simplified)
    state_clusters = {
        "bangalore": ["bangalore", "bengaluru", "mysore", "mangalore"],
        "pune": ["pune", "nashik", "aurangabad"],
        "hyderabad": ["hyderabad", "secunderabad"],
        "mumbai": ["mumbai", "thane", "navi mumbai", "pune"],
        "delhi": ["delhi", "gurgaon", "noida", "faridabad", "ghaziabad"],
        "chennai": ["chennai", "coimbatore", "salem"],
        "kolkata": ["kolkata", "howrah"],
        "ahmedabad": ["ahmedabad", "gandhinagar", "surat", "vadodara"],
    }
    profile_states = set()
    job_states = set()
    for state, cities in state_clusters.items():
        for pref in profile.preferred_locations:
            if any(c in pref.lower() for c in cities):
                profile_states.add(state)
        if any(c in job_loc for c in cities):
            job_states.add(state)

    if profile_states & job_states:
        return 0.7

    return 0.3


_domain_model = None


def _get_embedding(text: str) -> np.ndarray:
    """Get sentence embedding for text."""
    global _domain_model
    if _domain_model is None:
        from sentence_transformers import SentenceTransformer
        _domain_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _domain_model.encode(text, normalize_embeddings=True)


def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b))


def domain_score(profile: CandidateProfile, job: JobListing) -> float:
    """
    Cosine similarity between profile domain_expertise + summary
    and job.description using sentence-transformers embeddings.
    """
    profile_text = f"{profile.domain_expertise} {profile.summary} {profile.headline}"
    job_text = f"{job.description} {job.role}"

    if not profile_text.strip() or not job_text.strip():
        return 0.5

    try:
        p_emb = _get_embedding(profile_text)
        j_emb = _get_embedding(job_text)
        sim = _cosine_sim(p_emb, j_emb)
        return round(max(0.0, min(1.0, sim)), 3)
    except Exception as e:
        logger.warning(f"Domain embedding failed: {e}")
        return 0.5


# ── Weights ────────────────────────────────────────────────────────────────────

WEIGHTS = {
    "skill": 0.30,
    "experience": 0.20,
    "certification": 0.15,
    "location": 0.15,
    "domain": 0.20,
}


def compute_match_score(profile: CandidateProfile, job: JobListing) -> tuple[float, dict]:
    """
    Compute weighted match score and return breakdown.
    Returns (score, breakdown_dict).
    """
    s_skill = skill_score(profile, job)
    s_exp = experience_score(profile, job)
    s_cert = cert_score(profile, job)
    s_loc = location_score(profile, job)
    s_domain = domain_score(profile, job)

    total = (
        WEIGHTS["skill"] * s_skill +
        WEIGHTS["experience"] * s_exp +
        WEIGHTS["certification"] * s_cert +
        WEIGHTS["location"] * s_loc +
        WEIGHTS["domain"] * s_domain
    )

    breakdown = {
        "skill": s_skill,
        "experience": s_exp,
        "certification": s_cert,
        "location": s_loc,
        "domain": s_domain,
        "weights": WEIGHTS,
    }

    return round(min(1.0, total), 3), breakdown


async def enrich_job_with_llm(job: JobListing) -> None:
    """Use LLM to extract structured data from job description if missing."""
    client = get_llm_client()

    # Extract skills
    if not job.primary_skills:
        try:
            resp = await client.generate_structured(
                EXTRACT_JOB_SKILLS_SYSTEM,
                f"### JOB DESCRIPTION\n{job.description[:4000]}"
            )
            job.primary_skills = resp.get("primary_skills", [])
            job.secondary_skills = resp.get("secondary_skills", [])
            job.certifications_required = resp.get("certifications", [])
        except Exception as e:
            logger.warning(f"LLM skill extraction failed: {e}")

    # Extract experience
    if job.experience_min is None and job.experience_max is None:
        # Try regex first
        job.experience_min, job.experience_max = _extract_experience_regex(job.description)
        # Fallback to LLM
        if job.experience_min is None:
            try:
                resp = await client.generate_structured(
                    EXTRACT_EXPERIENCE_SYSTEM,
                    f"### JOB POSTING\n{job.description[:4000]}"
                )
                job.experience_min = resp.get("min_years")
                job.experience_max = resp.get("max_years")
            except Exception as e:
                logger.warning(f"LLM experience extraction failed: {e}")


def priority_tier(match_score: float) -> str:
    if match_score >= 0.92:
        return "APPLY_NOW"
    if match_score >= 0.85:
        return "STRONG_FIT"
    if match_score >= 0.75:
        return "CONSIDER"
    return "LOW"


@dataclass
class JobMatchResult:
    job_id: str
    company: str
    role: str
    location: str | None
    job_type: str | None
    experience_required: str
    salary_estimate_lpa: str | None
    match_score: float
    match_score_pct: int
    skill_breakdown: dict
    apply_link: str
    source_portal: str
    discovered_at: str
    priority_tier: str
