"""Resume-derived default answers for common job application screening questions.

Maps common question text patterns to fields in the user's Profile/Resume so
that repetitive questions can be auto-filled without hitting the LLM.
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

# ── Pattern → extractor mapping ───────────────────────────────────────────────

_DEFAULT_PATTERNS: list[tuple[str, str]] = [
    # (regex pattern, profile key)
    (r"total\s*experience|years?\s*of\s*experience|how\s*many\s*years", "experience_years"),
    (r"current\s*ctc|current\s*salary|present\s*salary|annual\s*salary", "current_ctc"),
    (r"expected\s*ctc|expected\s*salary|salary\s*expectation", "expected_ctc"),
    (r"notice\s*period|joining\s*time|how\s*soon|available\s*from", "notice_period"),
    (r"current\s*location|present\s*location|city|where\s*do\s*you\s*live", "location"),
    (r"willing\s*to\s*relocate|ready\s*to\s*relocate|can\s*you\s*relocate", "willing_to_relocate"),
    (r"highest\s*qualification|degree|education|academic", "education"),
    (r"key\s*skills|technologies\s*you\s*know|tech\s*stack|primary\s*skills", "skills"),
    (r"why\s*do\s*you\s*want\s*to\s*join|why\s*this\s*company|why\s*hire\s*you", "motivation"),
    (r"cover\s*letter|about\s*yourself|brief\s*summary|describe\s*yourself", "summary"),
    (r"linked?in\s*profile|portfolio|github|personal\s*website", "linkedin_url"),
    (r"phone\s*number|mobile\s*number|contact\s*number", "phone"),
    (r"email\s*address|email\s*id", "email"),
    (r"first\s*name|given\s*name", "first_name"),
    (r"last\s*name|surname|family\s*name", "last_name"),
    (r"full\s*name|complete\s*name", "full_name"),
    (r"current\s*company|present\s*employer|where\s*do\s*you\s*work", "current_company"),
    (r"current\s*designation|job\s*title|role\s*at\s*present", "headline"),
    (r"pan\s*number|aadhaar|passport|id\s*proof", "id_number"),
    (r"date\s*of\s*birth|dob|birthday", "dob"),
]


def get_default_answer(question_text: str, profile: dict) -> str | None:
    """Return a default answer from the user's profile if the question matches a known pattern.

    Args:
        question_text: The label / placeholder of the form field.
        profile: Dict built from User + Profile models (skills, experience, etc.).

    Returns:
        A string answer if a match is found, otherwise None.
    """
    if not question_text:
        return None

    q_lower = question_text.lower()

    for pattern, key in _DEFAULT_PATTERNS:
        if re.search(pattern, q_lower):
            answer = _extract_from_profile(key, profile)
            if answer:
                logger.debug(f"Default answer matched pattern '{pattern}' -> key={key}")
                return answer

    return None


def _extract_from_profile(key: str, profile: dict) -> str | None:
    """Pull a human-readable string from the profile dict for a given key."""
    exp = profile.get("experience", {})
    edu = profile.get("education", {})
    skills = profile.get("skills", [])

    extractors: dict[str, callable] = {
        "experience_years": lambda: _years_from_experience(exp),
        "current_ctc": lambda: str(profile.get("expected_salary_lpa", "")),
        "expected_ctc": lambda: str(profile.get("expected_salary_lpa", "")),
        "notice_period": lambda: _notice_period(profile),
        "location": lambda: profile.get("location", ""),
        "willing_to_relocate": lambda: "Yes" if profile.get("preferred_locations") else "Open to discussion",
        "education": lambda: _format_education(edu),
        "skills": lambda: ", ".join(skills[:10]) if isinstance(skills, list) else str(skills),
        "motivation": lambda: profile.get("summary", "")[:500],
        "summary": lambda: profile.get("summary", "")[:500],
        "linkedin_url": lambda: profile.get("linkedin_url", ""),
        "phone": lambda: profile.get("phone", ""),
        "email": lambda: profile.get("email", ""),
        "first_name": lambda: profile.get("first_name", ""),
        "last_name": lambda: profile.get("last_name", ""),
        "full_name": lambda: profile.get("full_name", ""),
        "current_company": lambda: _current_company(exp),
        "headline": lambda: profile.get("headline", ""),
        "id_number": lambda: "",  # sensitive — never auto-fill
        "dob": lambda: "",  # sensitive — never auto-fill
    }

    fn = extractors.get(key)
    if fn:
        try:
            val = fn()
            return val if val else None
        except Exception:
            return None
    return None


def _years_from_experience(exp: dict | list) -> str:
    """Try to compute total years from experience JSON."""
    if isinstance(exp, list):
        total = 0
        for e in exp:
            yrs = e.get("years", 0)
            if isinstance(yrs, (int, float)):
                total += yrs
        return f"{total} years" if total else ""
    if isinstance(exp, dict):
        total = exp.get("total_years", 0) or exp.get("years", 0)
        if total:
            return f"{total} years"
        # Fallback: count entries
        entries = exp.get("entries", exp.get("history", []))
        if isinstance(entries, list):
            return f"{len(entries)} years" if entries else ""
    return ""


def _notice_period(profile: dict) -> str:
    days = profile.get("notice_period_days")
    if days is None:
        return ""
    try:
        d = int(days)
        if d <= 15:
            return "15 days"
        if d <= 30:
            return "1 month"
        if d <= 60:
            return "2 months"
        if d <= 90:
            return "3 months"
        return f"{d} days"
    except (ValueError, TypeError):
        return str(days)


def _format_education(edu: dict | list) -> str:
    if isinstance(edu, list) and edu:
        top = edu[0]
        degree = top.get("degree", "")
        field = top.get("field", "")
        inst = top.get("institution", "")
        parts = [p for p in [degree, field, inst] if p]
        return ", ".join(parts)
    if isinstance(edu, dict):
        degree = edu.get("degree", "")
        field = edu.get("field", "")
        inst = edu.get("institution", "")
        parts = [p for p in [degree, field, inst] if p]
        return ", ".join(parts)
    return ""


def _current_company(exp: dict | list) -> str:
    if isinstance(exp, list) and exp:
        return exp[0].get("company", "")
    if isinstance(exp, dict):
        entries = exp.get("entries", exp.get("history", []))
        if isinstance(entries, list) and entries:
            return entries[0].get("company", "")
    return ""
