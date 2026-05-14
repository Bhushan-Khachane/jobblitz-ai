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
    jobs = await search_all(keywords, location, portal)

    # Log clearly
    sources = {}
    for j in jobs:
        sources.setdefault(j.get("source", "unknown"), 0)
        sources[j.get("source", "unknown")] += 1

    print(f"[discovery] {len(jobs)} jobs from {sources} for search: {keywords} in {location}")

    # Normalize and store job leads via backend API
    for lead in jobs:
        lead["portal"] = portal
        lead["search_profile_id"] = search_profile.get("id")
        if "url" not in lead:
            lead["url"] = None
        # Normalize description -> jd_text for screening agent
        if "description" in lead and "jd_text" not in lead:
            lead["jd_text"] = lead.pop("description")
        lead["source"] = portal

    try:
        async with httpx.AsyncClient() as http:
            await http.post(
                f"{ADK_API_URL}/discovery/job-leads/bulk-internal",
                json={
                    "user_id": search_profile.get("user_id"),
                    "portal": portal,
                    "leads": jobs,
                },
                headers={"x-service-token": os.getenv("INTERNAL_SERVICE_TOKEN", "jobblitz-internal-secret")},
                timeout=10.0,
            )
    except Exception:
        pass  # non-fatal, leads still returned

    return {
        "agent": "discovery",
        "leads_found": len(jobs),
        "leads": jobs,
    }
