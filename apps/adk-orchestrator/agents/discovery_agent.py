"""Discovery Agent — Uses official job APIs only. No browser scraping."""

import json
import os
from typing import Any

import httpx

from config.llm import async_generate
from tools.job_apis import search_all

ADK_API_URL = os.getenv("ADK_API_URL", "http://localhost:8000/api/v1")


async def run_discovery(search_profile: dict, session_id: str) -> dict:
    """Run discovery for a search profile using official job APIs.

    Input: search_profile (keywords, location, portal, years_experience, job_age_days)
    Output: list of job_lead dicts
    """
    keywords = search_profile.get("keywords", "")
    location = search_profile.get("location", "India")
    portal = search_profile.get("portal", "naukri")

    # Call official APIs
    jobs = await search_all(keywords, location)

    # Log clearly
    sources = {}
    for j in jobs:
        sources.setdefault(j.get("source", "unknown"), 0)
        sources[j.get("source", "unknown")] += 1

    print(f"[discovery] {len(jobs)} jobs from {sources} for search: {keywords} in {location}")

    # Optional: use LLM to clean/normalize ambiguous fields only
    if jobs:
        system = "You are a data normalizer. Return only valid JSON array, no explanation."
        prompt = f"""
These are job listings from public APIs (Adzuna, Jooble, Remotive).
Clean and normalize the data. Return valid JSON array.
Each item must have: title, company, location, description, url, salary, source, posted_at.

Raw data:
{json.dumps(jobs[:20], indent=2)}
"""
        try:
            normalized = await async_generate(prompt, system=system, use_pro=False)
            if "```json" in normalized:
                normalized = normalized.split("```json")[1].split("```")[0].strip()
            elif "```" in normalized:
                normalized = normalized.split("```")[1].split("```")[0].strip()
            cleaned = json.loads(normalized)
            if isinstance(cleaned, list):
                jobs = cleaned
        except Exception:
            pass  # use raw data if LLM fails

    # Store job leads via backend API
    for lead in jobs:
        lead["portal"] = portal
        lead["search_profile_id"] = search_profile.get("id")
        if "url" not in lead:
            lead["url"] = None

    try:
        async with httpx.AsyncClient() as http:
            await http.post(
                f"{ADK_API_URL}/job-leads/bulk",
                json={
                    "user_id": search_profile.get("user_id"),
                    "portal": portal,
                    "leads": jobs,
                },
                timeout=10.0,
            )
    except Exception:
        pass  # non-fatal, leads still returned

    return {
        "agent": "discovery",
        "leads_found": len(jobs),
        "leads": jobs,
    }
