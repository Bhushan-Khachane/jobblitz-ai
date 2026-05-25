"""Naukri Apply Flow — Step-by-step Naukri Easy Apply executor."""

import asyncio
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

BROWSER_WORKER_URL = os.getenv("BROWSER_WORKER_URL", "http://localhost:8002")


NAUKRI_APPLY_STEPS = [
    {
        "name": "click_apply",
        "action": "click",
        "target": "apply_ref",
        "verify": "apply now|applied|already applied|application",
        "on_fail": "blocked",
    },
    {
        "name": "fill_contact",
        "action": "fill_form",
        "fields": ["name", "email", "phone"],
        "verify": "next|continue|submit",
        "on_fail": "retry",
    },
    {
        "name": "upload_resume",
        "action": "upload",
        "target": "resume_input",
        "file": "user_resume_path",
        "verify": "uploaded|resume",
        "on_fail": "skip_upload",
    },
    {
        "name": "answer_questions",
        "action": "fill_questions",
        "source": "NAUKRI_QUESTION_ANSWERS",
        "verify": "next|submit",
        "on_fail": "require_approval",
    },
    {
        "name": "submit",
        "action": "click",
        "target": "submit_ref",
        "verify": "application submitted|successfully applied|thank you|applied",
        "on_fail": "blocked",
    },
]


async def execute_apply_flow(
    job: dict,
    user_profile: dict,
    session_id: str,
    dry_run: bool = False,
) -> dict:
    """
    Execute Naukri apply steps.
    Returns step-by-step events for application_step_events table.
    """
    events = []
    for step in NAUKRI_APPLY_STEPS:
        event = {
            "id": str(uuid.uuid4()),
            "step_name": step["name"],
            "tool_name": step["action"],
            "success": False,
            "screenshot_url": None,
            "diff_text": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if dry_run:
            event["success"] = True
            event["dry_run"] = True
            event["planned_action"] = step
            events.append(event)
            continue

        try:
            # Execute step via browser worker
            result = await _execute_step(step, job, user_profile, session_id)
            event["tool_output"] = result
            event["success"] = True

            # Screenshot after each step
            screenshot_path = f"/tmp/screenshots/step_{step['name']}_{session_id}_{uuid.uuid4().hex[:8]}.png"
            await _screenshot(screenshot_path, session_id)
            event["screenshot_url"] = screenshot_path

        except Exception as e:
            event["error_message"] = str(e)
            event["success"] = False
            if step["on_fail"] == "blocked":
                events.append(event)
                return {"status": "blocked", "failed_step": step["name"], "events": events}

        events.append(event)

    return {"status": "success", "events": events}


async def _execute_step(
    step: dict,
    job: dict,
    user_profile: dict,
    session_id: str,
) -> dict:
    """Execute a single apply step via browser worker."""
    async with httpx.AsyncClient() as http:
        action = step["action"]

        if action == "click":
            ref = job.get("apply_ref", "")
            resp = await http.post(
                f"{BROWSER_WORKER_URL}/click",
                json={"ref": ref, "session_id": session_id},
            )
            return {"action": "click", "ref": ref, "status": resp.status_code}

        elif action == "fill_form":
            # Fill basic contact fields
            fields = step.get("fields", [])
            results = {}
            for field in fields:
                value = user_profile.get(field, "")
                if value:
                    resp = await http.post(
                        f"{BROWSER_WORKER_URL}/fill",
                        json={"ref": f"input_{field}", "value": value, "session_id": session_id},
                    )
                    results[field] = resp.status_code
            return {"action": "fill_form", "fields": results}

        elif action == "upload":
            resume_path = user_profile.get("resume_path", "")
            if resume_path and os.path.exists(resume_path):
                resp = await http.post(
                    f"{BROWSER_WORKER_URL}/upload",
                    json={"ref": "resume_upload", "file_path": resume_path, "session_id": session_id},
                )
                return {"action": "upload", "status": resp.status_code}
            return {"action": "upload", "status": "skipped", "reason": "no resume"}

        elif action == "fill_questions":
            # For now, this requires human approval for custom questions
            return {"action": "fill_questions", "status": "requires_approval"}

        return {"action": action, "status": "unknown"}


async def _screenshot(path: str, session_id: str) -> None:
    """Take a screenshot via browser worker."""
    async with httpx.AsyncClient() as http:
        try:
            await http.post(
                f"{BROWSER_WORKER_URL}/screenshot",
                json={"path": path, "session_id": session_id},
            )
        except Exception:
            pass
