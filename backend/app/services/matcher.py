"""Semantic job-resume matching using sentence-transformers embeddings.

Replaces token-overlap scoring with cosine similarity of sentence embeddings,
while keeping India-specific heuristics (LPA, location clusters, seniority)
as rule-based adjustments.

Embedding cache in Redis (24h TTL) avoids re-encoding on every job match.
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import TYPE_CHECKING

from app.config import settings

logger = logging.getLogger(__name__)

_model = None


def _get_model():
    """Lazy-load the sentence-transformers model (downloaded on first use, ~80MB)."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


async def _get_redis():
    """Get a Redis connection for embedding cache. Returns None if unavailable."""
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return r
    except Exception:
        return None


async def _cache_get(key: str) -> list[float] | None:
    """Retrieve a cached embedding from Redis."""
    r = await _get_redis()
    if not r:
        return None
    try:
        data = await r.get(key)
        await r.aclose()
        if data:
            return json.loads(data)
        return None
    except Exception:
        return None


async def _cache_set(key: str, embedding: list[float], ttl: int = 86400) -> None:
    """Store an embedding in Redis with TTL (default 24h)."""
    r = await _get_redis()
    if not r:
        return
    try:
        await r.setex(key, ttl, json.dumps(embedding))
        await r.aclose()
    except Exception:
        pass


def _cache_key(text: str) -> str:
    """Generate a Redis key for an embedding."""
    h = hashlib.sha256(text.encode()).hexdigest()[:16]
    return f"embedding:{h}"


async def semantic_fit_score(
    job_title: str,
    job_description: str,
    resume_text: str,
    profile_skills: list[str] | None = None,
    resume_id: str | None = None,
) -> float:
    """Compute semantic similarity between job and resume using embeddings.

    Returns a float between 0.0 and 1.0.
    """
    import asyncio

    import numpy as np

    model = _get_model()

    # Combine job fields for embedding
    job_text = f"{job_title}. {job_description or ''}"
    resume_combined = resume_text or ""
    if profile_skills:
        resume_combined = f"{resume_combined} {' '.join(profile_skills)}"

    # Check cache for resume embedding (it's reused across many jobs)
    resume_key = _cache_key(resume_combined)
    if resume_id:
        resume_key = f"embedding:resume:{resume_id}"

    resume_emb = await _cache_get(resume_key)

    def _encode():
        texts = [job_text]
        if resume_emb is None:
            texts.append(resume_combined)
        return model.encode(texts, convert_to_tensor=True, normalize_embeddings=True)

    # Run encoding in executor to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    embeddings = await loop.run_in_executor(None, _encode)

    job_emb = embeddings[0].cpu().numpy()
    if resume_emb is not None:
        resume_arr = np.array(resume_emb, dtype=np.float32)
        # Normalize cached embedding
        norm = np.linalg.norm(resume_arr)
        if norm > 0:
            resume_arr = resume_arr / norm
    else:
        resume_arr = embeddings[1].cpu().numpy()
        # Cache the resume embedding
        await _cache_set(resume_key, resume_arr.tolist())

    # Cosine similarity (both are normalized)
    similarity = float(np.dot(job_emb, resume_arr))
    # Clamp to [0, 1]
    return max(0.0, min(1.0, (similarity + 1) / 2))


async def batch_semantic_fit_score(
    jobs: list[dict],
    resume_text: str,
    profile_skills: list[str] | None = None,
    resume_id: str | None = None,
) -> list[float]:
    """Compute semantic fit scores for multiple jobs against one resume.

    More efficient than calling semantic_fit_score in a loop because
    the resume embedding is computed only once.
    """
    import asyncio

    import numpy as np

    model = _get_model()

    resume_combined = resume_text or ""
    if profile_skills:
        resume_combined = f"{resume_combined} {' '.join(profile_skills)}"

    # Check cache for resume embedding
    resume_key = _cache_key(resume_combined)
    if resume_id:
        resume_key = f"embedding:resume:{resume_id}"

    resume_emb_cached = await _cache_get(resume_key)

    def _encode_all():
        job_texts = [f"{j.get('title', '')}. {j.get('description', '')}" for j in jobs]
        texts = job_texts
        if resume_emb_cached is None:
            texts.append(resume_combined)
        return model.encode(texts, convert_to_tensor=True, normalize_embeddings=True)

    loop = asyncio.get_event_loop()
    embeddings = await loop.run_in_executor(None, _encode_all)

    n_jobs = len(jobs)
    job_embeddings = embeddings[:n_jobs].cpu().numpy()

    if resume_emb_cached is not None:
        resume_arr = np.array(resume_emb_cached, dtype=np.float32)
        norm = np.linalg.norm(resume_arr)
        if norm > 0:
            resume_arr = resume_arr / norm
    else:
        resume_arr = embeddings[n_jobs].cpu().numpy()
        await _cache_set(resume_key, resume_arr.tolist())

    # Cosine similarities
    similarities = np.dot(job_embeddings, resume_arr)
    # Clamp to [0, 1]
    scores = ((similarities + 1) / 2).clip(0, 1)
    return scores.tolist()