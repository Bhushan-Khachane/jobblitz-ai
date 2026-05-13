"""Status Sync Agent — Uses LLM to sync portal inbox status."""

import json
import os
from datetime import datetime, timezone

import httpx
from config.llm import async_generate


BROWSER_WORKER_URL = os.getenv("BROWSER_WORKER_URL", "http://localhost:8002")


async def run_status_sync(user_id: str, portal: str, session_id: str) -> dict:
    """Sync status updates from a portal inbox.

    Input: user_id, portal
    Output: list of status updates
    """
    portal_inbox_urls = {
        "naukri": "https://www.naukri.com/mnjuser/homepage",
        "linkedin": "https://www.linkedin.com/inbox/",
    }

    async with httpx.AsyncClient() as http:
        inbox_url = portal_inbox_urls.get(portal, "https://www.naukri.com/mnjuser/homepage")
        await http.post(f"{BROWSER_WORKER_URL}/goto", json={"url": inbox_url, "session_id": session_id})

        text_resp = await http.post(f"{BROWSER_WORKER_URL}/text", json={"session_id": session_id})
        page_text = text_resp.text

        links_resp = await http.post(f"{BROWSER_WORKER_URL}/links", json={"session_id": session_id})
        page_links = links_resp.text

    system = "You are a status sync agent. Extract application status updates from job portal inbox pages."
    prompt = f"""
Given the text and links from a {portal} inbox page,
extract all status updates (interview invites, rejections, views, shortlists, offers).

Return ONLY a JSON array of objects with these exact keys:
- event_type (string: interview_invite / rejected / viewed / shortlisted / offer)
- job_title (string or null)
- company (string or null)
- event_data (object with any extra details)

Page text:
{page_text[:5000]}

Links:
{page_links[:2000]}
"""

    raw = await async_generate(prompt, system=system, use_pro=False)

    try:
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        events = json.loads(raw)
        if not isinstance(events, list):
            events = [events]
    except Exception:
        events = []

    # Enrich events
    for ev in events:
        ev["portal"] = portal
        ev["user_id"] = user_id
        ev["synced_at"] = datetime.now(timezone.utc).isoformat()

    return {
        "agent": "status_sync",
        "portal": portal,
        "events_found": len(events),
        "events": events,
    }
