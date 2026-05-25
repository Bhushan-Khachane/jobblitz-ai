"""
ATS Resume Scanner — replicates AIApply's ATS Checker feature.

Scans a resume against a job description and returns:
  • keyword_match_score  (0-100)
  • missing_keywords     (list)
  • matched_keywords     (list)
  • section_scores       (dict: summary/experience/education/skills)
  • ats_pass_probability (low | medium | high)
  • suggestions          (list of actionable fix items)
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.services.llm_client import LLMClient

logger = logging.getLogger(__name__)


class ATSScannerService:
    def __init__(self) -> None:
        self._llm = LLMClient()

    async def scan(
        self,
        resume_text: str,
        jd_text: str,
        target_role: str = "",
    ) -> dict[str, Any]:
        """
        Full ATS scan: keyword gap analysis + section scoring + suggestions.
        """
        prompt = (
            "You are an expert ATS (Applicant Tracking System) specialist.\n"
            f"Target Role: {target_role or 'inferred from JD'}\n"
            f"Job Description:\n{jd_text[:2500]}\n\n"
            f"Resume:\n{resume_text[:2500]}\n\n"
            "Perform a thorough ATS scan and return a JSON object with:\n"
            "  keyword_match_score: int (0-100),\n"
            "  matched_keywords: list of strings,\n"
            "  missing_keywords: list of strings,\n"
            "  section_scores: {summary: int, experience: int, education: int, skills: int},\n"
            "  ats_pass_probability: 'low'|'medium'|'high',\n"
            "  suggestions: list of actionable strings (max 8),\n"
            "  overall_score: int (0-100),\n"
            "  formatted_correctly: bool.\n"
            "Return ONLY the JSON object, no markdown."
        )
        raw = await self._llm.generate(prompt)
        text = re.sub(r"^```[a-z]*\n?", "", raw.strip(), flags=re.MULTILINE)
        text = re.sub(r"\n?```$", "", text.strip(), flags=re.MULTILINE)
        try:
            result = json.loads(text)
        except json.JSONDecodeError:
            result = {
                "keyword_match_score": 0,
                "matched_keywords": [],
                "missing_keywords": [],
                "section_scores": {},
                "ats_pass_probability": "low",
                "suggestions": ["Could not parse ATS analysis. Try again."],
                "overall_score": 0,
                "formatted_correctly": False,
            }
        return result

    async def quick_score(self, resume_text: str, jd_text: str) -> int:
        """Return just the overall ATS match score (0-100) quickly."""
        result = await self.scan(resume_text, jd_text)
        return result.get("overall_score", result.get("keyword_match_score", 0))


ats_scanner_service = ATSScannerService()
