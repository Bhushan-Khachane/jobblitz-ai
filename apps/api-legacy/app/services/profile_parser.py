"""Parse user profile into a structured CandidateProfile for scoring.

Wraps the existing Profile model data into the scoring format.
"""

from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import Profile, Resume, User
from app.services.match_scorer import CandidateProfile

logger = logging.getLogger(__name__)


def _parse_years_from_experience(experience: list[dict] | None) -> float:
    """Estimate total years of experience from experience entries."""
    if not experience:
        return 0.0
    total = 0.0
    for entry in experience:
        duration = str(entry.get("duration", "")).lower()
        # Parse "2020-2023" or "2020 – 2023" or "3 years"
        if "year" in duration:
            import re
            m = re.search(r"(\d+(?:\.\d+)?)", duration)
            if m:
                total += float(m.group(1))
                continue
        parts = duration.replace("–", "-").split("-")
        if len(parts) == 2:
            start = parts[0].strip()
            end = parts[1].strip()
            try:
                start_yr = int(start) if start.isdigit() else datetime.now().year
                end_yr = int(end) if end.isdigit() else datetime.now().year
                total += max(0, end_yr - start_yr)
            except ValueError:
                pass
    return total


def _extract_domain_expertise(profile: Profile) -> str:
    """Build domain expertise string from profile data."""
    parts = []
    if profile.headline:
        parts.append(profile.headline)
    if profile.summary:
        parts.append(profile.summary)
    if profile.skills:
        parts.append("Skills: " + ", ".join(profile.skills[:15]))
    if profile.preferred_job_titles:
        parts.append("Target roles: " + ", ".join(profile.preferred_job_titles[:5]))
    return " ".join(parts)


async def parse_candidate_profile(user_id: str, db: AsyncSession) -> CandidateProfile | None:
    """Load and parse a user's profile into CandidateProfile for scoring."""
    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        return None

    experience_years = profile.experience_years or _parse_years_from_experience(profile.experience)

    return CandidateProfile(
        user_id=user_id,
        headline=profile.headline or "",
        summary=profile.summary or "",
        core_skills=profile.skills or [],
        experience_years=experience_years,
        experience_level=profile.experience_level or "",
        preferred_locations=profile.preferred_locations or [],
        open_to_remote=not profile.remote_only,
        certifications=[
            c.get("name", "") for c in (profile.certifications or [])
            if isinstance(c, dict)
        ] if profile.certifications else [],
        domain_expertise=_extract_domain_expertise(profile),
        salary_min_lpa=profile.salary_min_lpa,
        salary_max_lpa=profile.salary_max_lpa,
        current_ctc_lpa=profile.current_ctc_lpa,
        languages=profile.languages or [],
        education=profile.education or [],
    )


async def save_parsed_profile(user_id: str, db: AsyncSession) -> None:
    """Parse profile and save parsed data back to DB."""
    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        return

    candidate = await parse_candidate_profile(user_id, db)
    if candidate:
        profile.parsed_profile = {
            "headline": candidate.headline,
            "core_skills": candidate.core_skills,
            "experience_years": candidate.experience_years,
            "experience_level": candidate.experience_level,
            "preferred_locations": candidate.preferred_locations,
            "certifications": candidate.certifications,
            "domain_expertise": candidate.domain_expertise,
            "salary_min_lpa": candidate.salary_min_lpa,
            "salary_max_lpa": candidate.salary_max_lpa,
        }
        profile.profile_parsed_at = datetime.now()
        await db.commit()
