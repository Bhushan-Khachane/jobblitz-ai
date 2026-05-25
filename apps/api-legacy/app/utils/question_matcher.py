from __future__ import annotations

import math
import re
from collections import Counter

from thefuzz import fuzz


def _tokenize(text: str) -> list[str]:
    return re.findall(r"\w+", text.lower())


def _cosine_similarity(vec_a: dict[str, float], vec_b: dict[str, float]) -> float:
    intersection = set(vec_a) & set(vec_b)
    if not intersection:
        return 0.0
    dot = sum(vec_a[k] * vec_b[k] for k in intersection)
    mag_a = math.sqrt(sum(v * v for v in vec_a.values()))
    mag_b = math.sqrt(sum(v * v for v in vec_b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _bow_vector(text: str) -> dict[str, float]:
    tokens = _tokenize(text)
    counts = Counter(tokens)
    total = len(tokens) or 1
    return {k: v / total for k, v in counts.items()}


def match_question(
    question: str,
    known_questions: list[str],
    threshold: float = 0.55,
) -> tuple[str | None, float]:
    """
    Return the best-matching known question and its combined score (0-1).
    Uses a weighted combination of fuzzy ratio (0.6) and bag-of-words cosine (0.4).
    Returns (None, 0.0) if best score < threshold.
    """
    if not known_questions:
        return None, 0.0

    q_vec = _bow_vector(question)
    best_q: str | None = None
    best_score = 0.0

    for candidate in known_questions:
        fuzzy = fuzz.token_sort_ratio(question, candidate) / 100.0
        cosine = _cosine_similarity(q_vec, _bow_vector(candidate))
        score = 0.6 * fuzzy + 0.4 * cosine
        if score > best_score:
            best_score = score
            best_q = candidate

    if best_score >= threshold:
        return best_q, best_score
    return None, best_score
