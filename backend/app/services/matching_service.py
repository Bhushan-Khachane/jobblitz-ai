from __future__ import annotations

import re


def _tokenize(text: str) -> set[str]:
    """Lowercase, strip punctuation, and return unique word tokens."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9#+\s]", " ", text)
    tokens = {t.strip() for t in text.split() if len(t.strip()) > 1}
    return tokens


def _extract_ngrams(tokens: set[str], n: int = 2) -> set[str]:
    """Return n-grams from a token set (e.g., 'machine learning')."""
    words = sorted(tokens)
    result = set()
    for i in range(len(words) - n + 1):
        result.add(" ".join(words[i : i + n]))
    return result


def match_job_to_resume(
    job_title: str,
    job_description: str,
    resume_text: str,
    profile_skills: list[str] | None = None,
    profile_job_titles: list[str] | None = None,
) -> float:
    """Return a match score between 0.0 and 1.0 based on keyword overlap.

    Weights:
      - skills overlap: 50%
      - job title overlap: 25% (boosted to 45% when description is very short)
      - description/resume overlap: 25% (reduced to 5% when description is very short)
    """
    profile_skills = profile_skills or []
    profile_job_titles = profile_job_titles or []

    job_combined = f"{job_title} {job_description or ''}"
    job_tokens = _tokenize(job_combined)
    job_bigrams = _extract_ngrams(job_tokens, 2)

    resume_tokens = _tokenize(resume_text or "")
    resume_bigrams = _extract_ngrams(resume_tokens, 2)

    # --- Skills score ---
    skill_tokens = set()
    for skill in profile_skills:
        skill_tokens.update(_tokenize(skill))
    if not skill_tokens:
        skill_tokens = resume_tokens

    # Fraction of job tokens that match the candidate's skills
    skill_overlap = len(job_tokens & skill_tokens) + len(job_bigrams & _extract_ngrams(skill_tokens, 2))
    skill_score = skill_overlap / max(len(job_tokens), 1)

    # --- Job title score ---
    job_title_tokens = _tokenize(job_title)
    job_title_bigrams = _extract_ngrams(job_title_tokens, 2)

    if profile_job_titles:
        # Compute best match against any single profile job title
        title_scores = []
        for title in profile_job_titles:
            t_tokens = _tokenize(title)
            t_bigrams = _extract_ngrams(t_tokens, 2)
            overlap = len(job_title_tokens & t_tokens) + len(job_title_bigrams & t_bigrams)
            score = overlap / max(len(job_title_tokens), 1)
            title_scores.append(score)
        title_score = max(title_scores) if title_scores else 0.0
    else:
        # Fall back to resume text overlap with job title
        overlap = len(job_title_tokens & resume_tokens) + len(job_title_bigrams & resume_bigrams)
        title_score = overlap / max(len(job_title_tokens), 1)

    # --- Description/resume overlap ---
    # Fraction of job tokens that appear anywhere in the resume
    desc_overlap = len(job_tokens & resume_tokens) + len(job_bigrams & resume_bigrams)
    desc_score = desc_overlap / max(len(job_tokens), 1)

    # When job description is very short, boost title weight
    desc_word_count = len(job_tokens)
    if desc_word_count < 10:
        title_weight = 0.45
        desc_weight = 0.05
    else:
        title_weight = 0.25
        desc_weight = 0.25

    # Weighted total
    score = (skill_score * 0.50) + (title_score * title_weight) + (desc_score * desc_weight)
    return round(min(1.0, max(0.0, score)), 3)
