"""Discovery Agent — Uses deterministic Naukri parser + LLM normalization."""

import json
import os
from typing import Any

import httpx
from config.llm import async_generate


ADK_API_URL = os.getenv("ADK_API_URL", "http://localhost:8000/api/v1")
BROWSER_WORKER_URL = os.getenv("BROWSER_WORKER_URL", "http://localhost:8002")


async def run_discovery(search_profile: dict, session_id: str) -> dict:
    """Run discovery for a search profile.

    Input: search_profile (keywords, location, portal, years_experience, job_age_days)
    Output: list of job_lead dicts
    """
    import sys
    # Import Naukri discovery parser
    sys.path.insert(0, "/app/packages")
    from portal_naukri.discovery import build_naukri_search_url, parse_naukri_job_cards

    portal = search_profile.get("portal", "naukri")

    # Step 1: Build search URL
    url = build_naukri_search_url(search_profile)

    # Step 2: Navigate and get snapshot
    async with httpx.AsyncClient() as http:
        await http.post(
            f"{BROWSER_WORKER_URL}/goto",
            json={"url": url, "session_id": session_id},
        )
        snap_resp = await http.post(
            f"{BROWSER_WORKER_URL}/snapshot",
            json={"session_id": session_id, "interactive": True},
        )
        snap = snap_resp.text

    # Step 3: Parse job cards deterministically
    job_cards = parse_naukri_job_cards(snap)

    # Step 4: Use LLM to clean/normalize ambiguous fields only
    if job_cards:
        system = "You are a data normalizer. Return only valid JSON array, no explanation."
        prompt = f"""
These are Naukri job listings extracted from a page snapshot.
Clean and normalize the data. Return valid JSON array.
Each item must have: title, company, location, experience, salary, url (use null if missing).

Raw data:
{json.dumps(job_cards[:20], indent=2)}
"""
        try:
            normalized = await async_generate(prompt, system=system, use_pro=False)
            if "```json" in normalized:
                normalized = normalized.split("```json")[1].split("```")[0].strip()
            elif "```" in normalized:
                normalized = normalized.split("```")[1].split("```")[0].strip()
            cleaned = json.loads(normalized)
            if isinstance(cleaned, list):
                job_cards = cleaned
        except Exception:
            pass  # use raw parsed data if LLM fails

    # Step 5: Store job leads via backend API
    for lead in job_cards:
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
                    "leads": job_cards,
                },
                timeout=10.0,
            )
    except Exception:
        pass  # non-fatal, leads still returned

    return {
        "agent": "discovery",
        "leads_found": len(job_cards),
        "leads": job_cards,
    }
