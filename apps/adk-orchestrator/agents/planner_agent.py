"""Planner Agent — Uses LLM to create application plans."""

import json
import os

import httpx
from config.llm import async_generate


BROWSER_WORKER_URL = os.getenv("BROWSER_WORKER_URL", "http://localhost:8002")


async def run_planner(job_lead: dict, user_profile: dict, fit_score: float, session_id: str) -> dict:
    """Create an application plan for a job lead.

    Input: job_lead URL, user_profile, fit_score
    Output: application_plan with form field intents
    """
    url = job_lead.get("url", "")

    # Navigate and snapshot the application form
    async with httpx.AsyncClient() as http:
        await http.post(f"{BROWSER_WORKER_URL}/goto", json={"url": url, "session_id": session_id})
        snap_resp = await http.post(
            f"{BROWSER_WORKER_URL}/snapshot",
            json={"session_id": session_id, "interactive": True},
        )
        form_text = snap_resp.text

    system = (
        "You are a job application planner. "
        "Given a job application form snapshot, plan the exact fill/click/upload actions needed. "
        "Return structured JSON with fields array."
    )
    prompt = f"""
Given a job application form and a candidate profile,
produce a structured plan to fill the form.

Candidate Profile:
{json.dumps(user_profile, indent=2)}

Fit Score: {fit_score}

Form Snapshot:
{form_text[:5000]}

Return ONLY a JSON object with these exact keys:
- fields (array of objects: {{"ref": "tbd", "type": "fill|select|upload|checkbox", "value": "...", "label": "..."}})
- resume_variant (string or null): a tailored resume summary if needed
- cover_letter (string or null): a tailored cover letter
- requires_approval (boolean): true if any upload field or ambiguous field is present

Rules:
- If fit_score < 80, requires_approval must be true
- If any field type is "upload", requires_approval must be true
- If any required field has no clear answer, requires_approval must be true
"""

    raw = await async_generate(prompt, system=system, use_pro=False)

    try:
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        plan = json.loads(raw)
    except Exception:
        plan = {
            "fields": [],
            "resume_variant": None,
            "cover_letter": None,
            "requires_approval": True,
        }

    return {
        "agent": "planner",
        "job_lead_id": job_lead.get("id"),
        "plan": plan,
    }
