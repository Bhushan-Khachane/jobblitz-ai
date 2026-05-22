"""
Interview preparation service — mirrors AIApply's Interview Buddy feature.

Capabilities:
  • Mock interview questions tailored to role + JD
  • Real-time answer coaching (streaming)
  • Company brief enrichment via Perplexity Sonar
  • Answer scoring with improvement tips
"""
from __future__ import annotations

import logging
from typing import Any, AsyncGenerator

from app.config import settings
from app.services.perplexity_service import perplexity_service
from app.services.llm_client import LLMClient

logger = logging.getLogger(__name__)


class InterviewService:
    def __init__(self) -> None:
        self._llm = LLMClient()

    # ── Question generation ───────────────────────────────────────────────── #

    async def generate_questions(
        self,
        role: str,
        jd_text: str,
        resume_text: str,
        question_types: list[str] | None = None,
        count: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Generate interview questions tailored to the candidate + role.

        question_types: ["behavioural", "technical", "system_design", "culture_fit"]
        """
        types = question_types or ["behavioural", "technical", "culture_fit"]
        prompt = (
            f"You are a senior interviewer at a top tech company.\n"
            f"Role: {role}\n"
            f"Job Description (excerpt): {jd_text[:1500]}\n"
            f"Candidate Resume (excerpt): {resume_text[:1000]}\n\n"
            f"Generate {count} interview questions of types: {', '.join(types)}.\n"
            "For each question return a JSON object with:\n"
            "  question (string), type (string), difficulty (easy|medium|hard),"
            "  ideal_answer_outline (2-3 bullet points), follow_up (string).\n"
            "Return ONLY a JSON array, no markdown."
        )
        raw = await self._llm.generate(prompt)
        import json, re  # noqa: E401
        text = re.sub(r"^```[a-z]*\n?", "", raw.strip(), flags=re.MULTILINE)
        text = re.sub(r"\n?```$", "", text.strip(), flags=re.MULTILINE)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return [{"question": raw, "type": "general", "difficulty": "medium", "ideal_answer_outline": [], "follow_up": ""}]

    # ── Answer scoring ────────────────────────────────────────────────────── #

    async def score_answer(
        self,
        question: str,
        answer: str,
        role: str,
    ) -> dict[str, Any]:
        """Score a candidate's answer and return improvement tips."""
        prompt = (
            f"You are a strict but fair interview coach.\n"
            f"Role: {role}\n"
            f"Question: {question}\n"
            f"Candidate Answer: {answer}\n\n"
            "Score the answer out of 10 and provide:\n"
            "  score (int 1-10), strengths (list), improvements (list),"
            "  model_answer (2-3 sentences), star_rating (1-5).\n"
            "Return ONLY a JSON object."
        )
        raw = await self._llm.generate(prompt)
        import json, re  # noqa: E401
        text = re.sub(r"^```[a-z]*\n?", "", raw.strip(), flags=re.MULTILINE)
        text = re.sub(r"\n?```$", "", text.strip(), flags=re.MULTILINE)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"score": 5, "strengths": [], "improvements": [raw], "model_answer": "", "star_rating": 3}

    # ── Live coaching hint (lightweight, for real-time overlay) ───────────── #

    async def live_hint(
        self,
        question: str,
        role: str,
        partial_answer: str = "",
    ) -> str:
        """Return a 1-2 sentence coaching hint for a live interview question."""
        context = f" The candidate has started answering: '{partial_answer}'" if partial_answer else ""
        prompt = (
            f"Interview question for {role}: '{question}'.{context}\n"
            "Give a concise 1-2 sentence coaching hint (key point to include, STAR structure reminder, etc.)."
            " Be direct and actionable. No preamble."
        )
        return await self._llm.generate(prompt)

    # ── Company brief (Perplexity-powered) ───────────────────────────────── #

    async def company_brief(self, company_name: str) -> dict[str, Any]:
        """Fetch live company intelligence for interview prep via Perplexity Sonar."""
        return await perplexity_service.get_company_brief(company_name)

    # ── Mock interview session management ────────────────────────────────── #

    async def start_session(
        self,
        role: str,
        company: str,
        jd_text: str,
        resume_text: str,
    ) -> dict[str, Any]:
        """Bootstrap a full mock interview session."""
        questions = await self.generate_questions(role, jd_text, resume_text)
        brief = await self.company_brief(company)
        return {
            "session_id": None,   # caller should persist in DB
            "role": role,
            "company": company,
            "company_brief": brief,
            "questions": questions,
            "total_questions": len(questions),
        }


interview_service = InterviewService()
