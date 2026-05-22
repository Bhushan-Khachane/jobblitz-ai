"""
Perplexity Sonar-powered real-time job discovery service.

Replaces the static scraper fallback for job search with live web-grounded
results from Perplexity's Sonar Pro API.  Results include source citations
so users can verify every posting directly.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

PERPLEXITY_CHAT_URL = "https://api.perplexity.ai/chat/completions"


class PerplexityJobService:
    """Calls the Perplexity Sonar API to discover live job postings."""

    def __init__(self) -> None:
        self._api_key = settings.PERPLEXITY_API_KEY
        self._model = settings.PERPLEXITY_MODEL
        self._recency = settings.PERPLEXITY_SEARCH_RECENCY_FILTER

    # ------------------------------------------------------------------ #
    #  Public interface                                                    #
    # ------------------------------------------------------------------ #

    async def search_jobs(
        self,
        user_summary: dict[str, Any],
        max_results: int = 20,
        extra_filters: str = "",
    ) -> dict[str, Any]:
        """
        Search for live jobs matching the user's profile summary.

        Args:
            user_summary: dict with keys:
                skills          – list[str]
                target_roles    – list[str]
                years_experience – int
                location        – str  (e.g. "Pune, India" or "Remote India")
                work_type       – str  ("remote" | "hybrid" | "onsite")
                salary_range    – str  (e.g. "10-20 LPA")
            max_results: maximum number of jobs to return
            extra_filters: free-form string appended to the prompt
        Returns:
            {"jobs": [...], "citations": [...], "search_query": str}
        """
        if not self._api_key:
            logger.warning("PERPLEXITY_API_KEY not set – returning empty results")
            return {"jobs": [], "citations": [], "search_query": ""}

        prompt = self._build_search_prompt(user_summary, max_results, extra_filters)
        raw = await self._call_sonar(prompt)
        return self._parse_response(raw, prompt)

    async def search_jobs_by_query(
        self,
        query: str,
        location: str = "",
        max_results: int = 20,
    ) -> dict[str, Any]:
        """Simple free-text job search, no profile context needed."""
        if not self._api_key:
            return {"jobs": [], "citations": [], "search_query": query}

        loc_clause = f" in {location}" if location else ""
        prompt = (
            f"Find {max_results} current job postings for: {query}{loc_clause}.\n"
            f"Only include jobs posted in the last {self._recency}.\n"
            "For each job return a JSON object with fields:\n"
            "  title, company, location, work_type, salary, apply_url,"
            "  posted_date, required_skills (array), match_reason.\n"
            "Return ONLY a JSON array, no markdown fences."
        )
        raw = await self._call_sonar(prompt)
        return self._parse_response(raw, prompt)

    async def get_company_brief(self, company_name: str) -> dict[str, Any]:
        """
        Fetch a rich company brief for the Interview Prep feature.
        Returns: {overview, culture, interview_style, recent_news, glassdoor_rating}
        """
        if not self._api_key:
            return {}

        prompt = (
            f"Give me a detailed company brief for '{company_name}' covering:\n"
            "1. Overview (what they do, size, funding stage)\n"
            "2. Culture & values\n"
            "3. Interview style (coding rounds, system design, behavioural)\n"
            "4. Recent news (last 3 months)\n"
            "5. Glassdoor rating (if available)\n"
            "Return a JSON object with keys: overview, culture, interview_style, recent_news, glassdoor_rating.\n"
            "Return ONLY the JSON object, no markdown fences."
        )
        raw = await self._call_sonar(prompt)
        content = raw.get("choices", [{}])[0].get("message", {}).get("content", "{}")
        try:
            return json.loads(self._strip_fences(content))
        except json.JSONDecodeError:
            return {"overview": content, "culture": "", "interview_style": "", "recent_news": "", "glassdoor_rating": ""}

    async def get_salary_intel(
        self,
        role: str,
        location: str,
        years_experience: int,
    ) -> dict[str, Any]:
        """Real-time salary benchmarking powered by Sonar web search."""
        if not self._api_key:
            return {}

        prompt = (
            f"Provide current salary benchmarks for a '{role}' with {years_experience} years\n"
            f"of experience in {location}.  Include:\n"
            "  - median_salary (annual, local currency)\n"
            "  - p25_salary\n"
            "  - p75_salary\n"
            "  - top_paying_companies (list of 5)\n"
            "  - market_trend (growing | stable | declining)\n"
            "Return ONLY a JSON object, no markdown fences."
        )
        raw = await self._call_sonar(prompt)
        content = raw.get("choices", [{}])[0].get("message", {}).get("content", "{}")
        try:
            return json.loads(self._strip_fences(content))
        except json.JSONDecodeError:
            return {"median_salary": content}

    # ------------------------------------------------------------------ #
    #  Internal helpers                                                   #
    # ------------------------------------------------------------------ #

    def _build_search_prompt(
        self,
        s: dict[str, Any],
        max_results: int,
        extra_filters: str,
    ) -> str:
        skills = ", ".join(s.get("skills", [])[:15])
        roles = ", ".join(s.get("target_roles", [])[:5])
        yoe = s.get("years_experience", 0)
        location = s.get("location", "India")
        work_type = s.get("work_type", "any")
        salary = s.get("salary_range", "")

        lines = [
            f"Find {max_results} current job openings that match this candidate profile:",
            f"- Target roles: {roles or 'any software engineering role'}",
            f"- Skills: {skills or 'software development'}",
            f"- Experience: {yoe} years",
            f"- Location: {location} (work type preference: {work_type})",
        ]
        if salary:
            lines.append(f"- Salary expectation: {salary}")
        if extra_filters:
            lines.append(f"- Additional filters: {extra_filters}")
        lines += [
            f"Only include jobs posted in the last {self._recency}.",
            "For EACH job return a JSON object with exactly these keys:",
            "  title, company, location, work_type, salary, apply_url,",
            "  posted_date, required_skills (array), match_score (0-100),",
            "  match_reason (1-2 sentences explaining fit).",
            f"Return a JSON array of {max_results} objects. No markdown fences, no extra text.",
        ]
        return "\n".join(lines)

    async def _call_sonar(self, prompt: str) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
            "search_recency_filter": self._recency,
            "return_citations": True,
            "temperature": 0.1,
        }
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(PERPLEXITY_CHAT_URL, json=payload, headers=headers)
                resp.raise_for_status()
                return resp.json()
        except httpx.HTTPStatusError as exc:
            logger.error("Perplexity API error %s: %s", exc.response.status_code, exc.response.text)
            return {}
        except Exception as exc:  # noqa: BLE001
            logger.error("Perplexity call failed: %s", exc)
            return {}

    def _parse_response(self, raw: dict[str, Any], prompt: str) -> dict[str, Any]:
        citations: list[str] = raw.get("citations", [])
        content = raw.get("choices", [{}])[0].get("message", {}).get("content", "[]")
        content = self._strip_fences(content)

        # Try to extract JSON array even if model adds prose around it
        match = re.search(r"\[.*\]", content, re.DOTALL)
        if match:
            content = match.group(0)

        try:
            jobs = json.loads(content)
            if not isinstance(jobs, list):
                jobs = []
        except json.JSONDecodeError:
            logger.warning("Failed to parse Perplexity job results as JSON")
            jobs = []

        # Normalise: guarantee required fields exist
        for job in jobs:
            job.setdefault("title", "Unknown Role")
            job.setdefault("company", "Unknown Company")
            job.setdefault("location", "")
            job.setdefault("apply_url", "")
            job.setdefault("match_score", 0)
            job.setdefault("required_skills", [])
            job.setdefault("match_reason", "")
            job.setdefault("source", "perplexity_sonar")

        return {"jobs": jobs, "citations": citations, "search_query": prompt[:500]}

    @staticmethod
    def _strip_fences(text: str) -> str:
        """Remove ```json ... ``` markdown code fences."""
        text = re.sub(r"^```[a-z]*\n?", "", text.strip(), flags=re.MULTILINE)
        text = re.sub(r"\n?```$", "", text.strip(), flags=re.MULTILINE)
        return text.strip()


# Module-level singleton
perplexity_service = PerplexityJobService()
