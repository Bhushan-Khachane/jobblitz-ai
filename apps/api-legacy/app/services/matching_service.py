"""
Hybrid job-resume matching service.

Combines:
1. Semantic embedding scoring (sentence-transformers cosine similarity)
2. India-specific normalization (LPA, notice period, city clusters, title variants)
3. Rule-based hard filters (deal-breakers)
4. Structured score breakdown with explanations
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ── India-specific normalization ──────────────────────────────────────────────

METRO_CLUSTERS: dict[str, list[str]] = {
    "bangalore": ["bangalore", "bengaluru", "blr", "bengluru"],
    "pune": ["pune", "pnq"],
    "hyderabad": ["hyderabad", "hyd", "secunderabad"],
    "mumbai": ["mumbai", "bombay", "navi mumbai", "thane"],
    "gurgaon": ["gurgaon", "gurugram", "ggn"],
    "noida": ["noida", "greater noida", "gnoida", "noida extension"],
    "chennai": ["chennai", "madras"],
    "delhi": ["delhi", "new delhi", "ncr", "noida", "gurgaon"],
    "kolkata": ["kolkata", "calcutta"],
    "ahmedabad": ["ahmedabad", "amdavad"],
}

REMOTE_VARIANTS = {
    "remote", "work from home", "wfh", "hybrid", "work from anywhere",
    "distributed", "virtual", "telecommute",
}

SENIORITY_MAP: dict[str, list[str]] = {
    "intern": ["intern", "internship", "trainee", "fresher", "entry level"],
    "junior": ["junior", "jr", "associate", "i", "1"],
    "mid": ["mid", "mid-level", "ii", "2-3", "2", "3"],
    "senior": ["senior", "sr", "sr.", "lead", "iii", "4", "5"],
    "staff": ["staff", "principal", "architect", "iv"],
    "manager": ["manager", "mgr", "head", "director", "vp", "vp of"],
}

TITLE_NORMALIZATIONS: dict[str, str] = {
    "sde": "software engineer",
    "sse": "senior software engineer",
    "swe": "software engineer",
    "dev": "developer",
    "sde i": "software engineer",
    "sde ii": "software engineer",
    "sde iii": "senior software engineer",
    "fullstack": "full stack",
    "full-stack": "full stack",
    "full stack": "full stack",
    "frontend": "front end",
    "front-end": "front end",
    "backend": "back end",
    "back-end": "back end",
    "data scientist": "data scientist",
    "ml engineer": "machine learning engineer",
    "ai engineer": "artificial intelligence engineer",
    "devops": "devops engineer",
    "sre": "site reliability engineer",
    "product manager": "product manager",
    "pm": "product manager",
    "tpm": "technical program manager",
    "qa": "quality assurance",
    "test": "qa engineer",
}

SKILL_SYNONYMS: dict[str, list[str]] = {
    "react": ["react", "reactjs", "react.js", "react js"],
    "angular": ["angular", "angularjs", "angular.js"],
    "vue": ["vue", "vuejs", "vue.js", "vue js"],
    "node": ["node", "nodejs", "node.js", "node js"],
    "python": ["python", "python3", "py"],
    "java": ["java", "java8", "java11", "java17", "j2ee", "jee"],
    "aws": ["aws", "amazon web services", "amazon aws"],
    "azure": ["azure", "microsoft azure", "ms azure"],
    "gcp": ["gcp", "google cloud", "google cloud platform"],
    "kubernetes": ["kubernetes", "k8s", "kube"],
    "docker": ["docker", "containerization", "containers"],
    "sql": ["sql", "mysql", "postgresql", "postgres", "mssql", "tsql"],
    "javascript": ["javascript", "js", "es6", "es2015", "ecmascript"],
    "typescript": ["typescript", "ts", "ts.js"],
    "ci/cd": ["ci/cd", "cicd", "ci cd", "continuous integration", "continuous delivery"],
    "machine learning": ["machine learning", "ml", "deep learning", "dl", "ai/ml"],
    "data engineering": ["data engineering", "data engineer", "etl", "data pipeline"],
}


# ── Scoring data structures ──────────────────────────────────────────────────

@dataclass
class MatchResult:
    """Structured match result with per-dimension scores and explanation."""
    fit_score: float
    role_quality_score: float
    compensation_score: float
    location_score: float
    confidence_score: float
    final_score: float
    explanation: dict
    hard_blockers: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "fit_score": round(self.fit_score, 3),
            "role_quality_score": round(self.role_quality_score, 3),
            "compensation_score": round(self.compensation_score, 3),
            "location_score": round(self.location_score, 3),
            "confidence_score": round(self.confidence_score, 3),
            "final_score": round(self.final_score, 3),
            "explanation": self.explanation,
            "hard_blockers": self.hard_blockers,
        }


# ── Helper functions ──────────────────────────────────────────────────────────

def _tokenize(text: str) -> set[str]:
    """Lowercase, strip punctuation, return unique word tokens."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9#+\s]", " ", text)
    tokens = {t.strip() for t in text.split() if len(t.strip()) > 1}
    return tokens


def _ordered_tokens(text: str) -> list[str]:
    """Return ordered list of tokens from text, preserving word order."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9#+\s]", " ", text)
    return [t.strip() for t in text.split() if len(t.strip()) > 1]


def _extract_ngrams(text: str, n: int = 2) -> set[str]:
    """Return n-grams from text, preserving word order."""
    words = _ordered_tokens(text)
    if len(words) < n:
        return set()
    return {" ".join(words[i : i + n]) for i in range(len(words) - n + 1)}


def _normalize_title(title: str) -> str:
    """Normalize job title variants to canonical form using word boundary matching."""
    t = title.lower().strip()
    for variant, canonical in TITLE_NORMALIZATIONS.items():
        pattern = r'\b' + re.escape(variant) + r'\b'
        t = re.sub(pattern, canonical, t)
    return t.strip()


def _extract_seniority(title: str) -> str | None:
    """Extract seniority level from a job title using word boundary matching."""
    t = title.lower()
    for level, keywords in SENIORITY_MAP.items():
        for kw in keywords:
            # Use word boundary matching to avoid "pm" matching inside "campus"
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, t):
                return level
    return None


def _normalize_location(location: str) -> str | None:
    """Normalize Indian city names to their canonical cluster."""
    if not location:
        return None
    loc = location.lower().strip()
    # Check for remote
    for variant in REMOTE_VARIANTS:
        if variant in loc:
            return "remote"
    # Check metro clusters
    for canonical, variants in METRO_CLUSTERS.items():
        for variant in variants:
            if variant in loc:
                return canonical
    return loc


def _expand_skills(skills: list[str]) -> set[str]:
    """Expand skills with synonyms for broader matching."""
    expanded = set()
    for skill in skills:
        s_lower = skill.lower().strip()
        expanded.add(s_lower)
        # Check synonym groups
        for canonical, variants in SKILL_SYNONYMS.items():
            if s_lower in variants or s_lower == canonical:
                expanded.add(canonical)
                expanded.update(variants)
    return expanded


def _parse_lpa(salary_str: str | None) -> float | None:
    """Parse LPA (Lakhs Per Annum) from salary string."""
    if not salary_str:
        return None
    # Match patterns like "12-15 LPA", "12 LPA", "12-15 Lakhs", "12-15 L"
    m = re.search(r"(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*(?:lpa|l|lakhs|lakh)", salary_str.lower())
    if m:
        return (float(m.group(1)) + float(m.group(2))) / 2
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:lpa|l|lakhs|lakh)", salary_str.lower())
    if m:
        return float(m.group(1))
    return None


# ── Main matching function ─────────────────────────────────────────────────────

async def match_job_to_resume(
    job_title: str,
    job_description: str,
    resume_text: str,
    profile_skills: list[str] | None = None,
    profile_job_titles: list[str] | None = None,
    job_location: str | None = None,
    job_salary: str | None = None,
    preferred_locations: list[str] | None = None,
    expected_salary_lpa: float | None = None,
    notice_period_days: int | None = None,
    job_notice_period_days: int | None = None,
    job_seniority: str | None = None,
    experience_years: int | None = None,
    resume_id: str | None = None,
) -> float:
    """
    Return a match score between 0.0 and 1.0 using semantic matching.

    This is the backward-compatible entry point that returns a single float.
    For structured results, use `match_job_to_resume_detailed()`.
    """
    result = await match_job_to_resume_detailed(
        job_title=job_title,
        job_description=job_description,
        resume_text=resume_text,
        profile_skills=profile_skills,
        profile_job_titles=profile_job_titles,
        job_location=job_location,
        job_salary=job_salary,
        preferred_locations=preferred_locations,
        expected_salary_lpa=expected_salary_lpa,
        notice_period_days=notice_period_days,
        job_notice_period_days=job_notice_period_days,
        job_seniority=job_seniority,
        experience_years=experience_years,
        resume_id=resume_id,
    )
    return result.final_score


async def match_job_to_resume_detailed(
    job_title: str,
    job_description: str,
    resume_text: str,
    profile_skills: list[str] | None = None,
    profile_job_titles: list[str] | None = None,
    job_location: str | None = None,
    job_salary: str | None = None,
    preferred_locations: list[str] | None = None,
    expected_salary_lpa: float | None = None,
    notice_period_days: int | None = None,
    job_notice_period_days: int | None = None,
    job_seniority: str | None = None,
    experience_years: int | None = None,
    resume_id: str | None = None,
) -> MatchResult:
    """
    Detailed matching with per-dimension scores and explanations.

    Uses semantic embeddings for fit_score and India-specific heuristics
    for compensation, location, and seniority scoring.

    Returns a MatchResult with:
    - fit_score: semantic similarity (embedding cosine)
    - role_quality_score: title match quality (token-based)
    - compensation_score: salary alignment
    - location_score: location preference match
    - confidence_score: how confident we are in the match
    - final_score: weighted combination
    - explanation: human-readable breakdown
    - hard_blockers: deal-breaker conditions
    """
    profile_skills = profile_skills or []
    profile_job_titles = profile_job_titles or []

    # ── 1. Fit Score (semantic embedding similarity) ────────────────────────
    try:
        from app.services.matcher import semantic_fit_score

        fit_score = await semantic_fit_score(
            job_title=job_title,
            job_description=job_description,
            resume_text=resume_text,
            profile_skills=profile_skills,
            resume_id=resume_id,
        )
    except Exception as e:
        logger.warning(f"Semantic matching failed, using fallback: {e}")
        # Fallback to simple token overlap if embeddings unavailable
        job_tokens = _tokenize(f"{job_title} {job_description or ''}")
        resume_tokens = _tokenize(resume_text or "")
        if not job_tokens:
            fit_score = 0.0
        else:
            fit_score = len(job_tokens & resume_tokens) / max(len(job_tokens), 1)

    # ── 2. Role Quality Score (title match) ────────────────────────────────
    job_title_norm = _normalize_title(job_title)
    job_title_tokens = _tokenize(job_title_norm)
    job_title_bigrams = _extract_ngrams(job_title_norm, 2)
    # Compute unconditionally — needed for the else branch below
    resume_tokens = _tokenize(resume_text or "")
    resume_bigrams = _extract_ngrams(resume_text or "", 2)

    if profile_job_titles:
        title_scores = []
        for title in profile_job_titles:
            t_norm = _normalize_title(title)
            t_tokens = _tokenize(t_norm)
            t_bigrams = _extract_ngrams(t_norm, 2)
            # Use word-boundary-aware token overlap for title matching
            overlap = len(job_title_tokens & t_tokens) + len(job_title_bigrams & t_bigrams)
            score = overlap / max(len(job_title_tokens) + len(job_title_bigrams), 1)
            # Bonus for exact normalized match
            if t_norm == job_title_norm:
                score = max(score, 0.9)
            title_scores.append(score)
        role_quality_score = max(title_scores) if title_scores else 0.0
    else:
        overlap = len(job_title_tokens & resume_tokens) + len(job_title_bigrams & resume_bigrams)
        role_quality_score = overlap / max(len(job_title_tokens), 1)

    # ── 3. Compensation Score ───────────────────────────────────────────────
    compensation_score = 0.5  # neutral when unknown
    compensation_detail = "Salary data not available"

    if expected_salary_lpa and job_salary:
        job_lpa = _parse_lpa(job_salary)
        if job_lpa is not None:
            if job_lpa >= expected_salary_lpa:
                compensation_score = min(1.0, 0.5 + (job_lpa - expected_salary_lpa) / max(expected_salary_lpa, 1) * 0.5)
                compensation_detail = f"Job offers {job_lpa} LPA vs expected {expected_salary_lpa} LPA — meets expectations"
            else:
                gap_ratio = job_lpa / max(expected_salary_lpa, 1)
                compensation_score = max(0.0, gap_ratio * 0.5)
                compensation_detail = f"Job offers {job_lpa} LPA vs expected {expected_salary_lpa} LPA — below expectations"
        else:
            compensation_detail = "Could not parse salary from job listing"

    # ── 4. Location Score ──────────────────────────────────────────────────
    location_score = 0.5  # neutral when unknown
    location_detail = "Location preference not specified"

    if job_location and preferred_locations:
        job_loc_norm = _normalize_location(job_location)
        pref_locs_norm = [_normalize_location(loc) for loc in preferred_locations]

        if job_loc_norm == "remote":
            if "remote" in pref_locs_norm or "hybrid" in pref_locs_norm:
                location_score = 1.0
                location_detail = "Remote job matches remote preference"
            else:
                location_score = 0.7
                location_detail = "Remote job, but no remote preference set"
        elif any(loc == job_loc_norm for loc in pref_locs_norm):
            location_score = 1.0
            location_detail = f"Job in {job_loc_norm} matches your preferred location"
        elif any(loc == "remote" for loc in pref_locs_norm):
            location_score = 0.3
            location_detail = f"Job is on-site in {job_loc_norm}, but you prefer remote"
        else:
            # Check if any preferred location is in the same metro cluster
            found_cluster = False
            for pref_loc in pref_locs_norm:
                if pref_loc and pref_loc != "remote":
                    # Check if both are in Delhi NCR
                    job_cluster = _get_metro_cluster(job_loc_norm) if job_loc_norm else None
                    pref_cluster = _get_metro_cluster(pref_loc) if pref_loc else None
                    if job_cluster and job_cluster == pref_cluster:
                        location_score = 0.7
                        location_detail = f"Job in {job_loc_norm}, nearby your preferred {pref_loc} (same metro area)"
                        found_cluster = True
                        break
            if not found_cluster:
                location_score = 0.2
                location_detail = f"Job in {job_loc_norm}, not in your preferred locations"
    elif job_location:
        location_detail = f"Job located in {job_location}"

    # ── 5. Confidence Score ─────────────────────────────────────────────────
    confidence_score = 0.5
    confidence_factors = []

    if len(job_tokens) >= 20:
        confidence_score += 0.15
        confidence_factors.append("substantial job description")
    else:
        confidence_factors.append("short job description — score may be unreliable")

    if profile_skills:
        confidence_score += 0.15
        confidence_factors.append("profile skills available")
    else:
        confidence_factors.append("no profile skills — using resume text only")

    if profile_job_titles:
        confidence_score += 0.10
        confidence_factors.append("preferred job titles available")

    if job_salary:
        confidence_score += 0.05
        confidence_factors.append("salary data available")

    confidence_score = min(1.0, confidence_score)

    # ── 6. Hard Blockers (deal-breakers) ────────────────────────────────────
    hard_blockers = []

    # Notice period mismatch
    if notice_period_days and job_notice_period_days:
        if notice_period_days > job_notice_period_days:
            hard_blockers.append(
                f"Notice period mismatch: you have {notice_period_days} days, job requires {job_notice_period_days} days"
            )

    # ── 7. Seniority Mismatch Warning ──────────────────────────────────────
    seniority_warning = None
    if experience_years is not None:
        job_sen = _extract_seniority(job_title)
        if job_sen:
            expected_years = {
                "intern": (0, 0),
                "junior": (0, 2),
                "mid": (2, 5),
                "senior": (5, 10),
                "staff": (8, 15),
                "manager": (6, 20),
            }
            if job_sen in expected_years:
                lo, hi = expected_years[job_sen]
                if experience_years < lo:
                    seniority_warning = f"Job expects {job_sen} level ({lo}-{hi} years), you have {experience_years} years"
                elif experience_years > hi + 3:
                    seniority_warning = f"Job expects {job_sen} level ({lo}-{hi} years), you may be overqualified with {experience_years} years"

    # ── 8. Final Score (weighted combination) ──────────────────────────────
    final_score = (
        fit_score * 0.45 +
        role_quality_score * 0.20 +
        compensation_score * 0.15 +
        location_score * 0.10 +
        confidence_score * 0.10
    )
    final_score = round(min(1.0, max(0.0, final_score)), 3)

    # ── 9. Build Explanation ────────────────────────────────────────────────
    explanation = {
        "semantic_fit": round(fit_score, 3),
        "title_match": round(role_quality_score, 3),
        "compensation": compensation_detail,
        "location": location_detail,
        "confidence_factors": confidence_factors,
    }

    if seniority_warning:
        explanation["seniority_warning"] = seniority_warning

    return MatchResult(
        fit_score=round(fit_score, 3),
        role_quality_score=round(role_quality_score, 3),
        compensation_score=round(compensation_score, 3),
        location_score=round(location_score, 3),
        confidence_score=round(confidence_score, 3),
        final_score=final_score,
        explanation=explanation,
        hard_blockers=hard_blockers,
    )


def _get_metro_cluster(location: str | None) -> str | None:
    """Return the metro cluster name for a location, or None."""
    if not location:
        return None
    loc = location.lower().strip()
    for canonical, variants in METRO_CLUSTERS.items():
        for variant in variants:
            if variant in loc:
                return canonical
    return None