"""Apply Agent — Executes application plans via browser tools."""

import os
import uuid
from datetime import datetime, timezone

import httpx

from state.run_tracker import update_run_progress

# Import the Naukri apply flow
import sys
sys.path.insert(0, "/app/packages/portal_naukri")
from apply_flow import execute_apply_flow


BROWSER_WORKER_URL = os.getenv("BROWSER_WORKER_URL", "http://localhost:8002")
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://backend:8000/api/v1")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "jobblitz-internal-dev-key")


async def run_apply(application_plan: dict, session_id: str, run_id: str, dry_run: bool = False) -> dict:
    """Execute an application plan using the portal-specific apply flow.

    Input: application_plan, session_id, run_id, dry_run
    Output: application_run result with step_events
    """
    job = application_plan.get("job", {})
    user_profile = application_plan.get("user_profile", {})

    try:
        result = await execute_apply_flow(job, user_profile, session_id, dry_run=dry_run)
    except Exception as e:
        return {
            "agent": "apply",
            "run_id": run_id,
            "status": "failed",
            "error": str(e),
            "step_events": [],
        }

    # Post step events to backend
    for event in result.get("events", []):
        await _post_step_event(run_id, event)
        await update_run_progress(run_id, event.get("step_name", "unknown"), {
            "success": event.get("success", False),
            "dry_run": event.get("dry_run", False),
        })

    all_success = all(e.get("success", False) for e in result.get("events", []))

    return {
        "agent": "apply",
        "run_id": run_id,
        "steps_executed": len(result.get("events", [])),
        "step_events": result.get("events", []),
        "status": "success" if all_success else "failed",
        "dry_run": dry_run,
    }


async def _post_step_event(run_id: str, event: dict) -> None:
    """Persist a step event to the backend application_step_events table."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{BACKEND_API_URL}/application-runs/{run_id}/step-events",
                headers={"X-Internal-Api-Key": INTERNAL_API_KEY},
                json={
                    "run_id": run_id,
                    "step_name": event.get("step_name", ""),
                    "tool_name": event.get("tool_name", ""),
                    "tool_args": event.get("planned_action") or {},
                    "tool_output": event.get("tool_output", ""),
                    "success": event.get("success", False),
                    "dry_run": event.get("dry_run", False),
                    "planned_action": event.get("planned_action"),
                    "error_message": event.get("error_message", ""),
                    "screenshot_url": event.get("screenshot_url", ""),
                    "diff_text": event.get("diff_text", ""),
                },
            )
    except Exception:
        # Best-effort persistence; don't fail the apply flow
        pass
