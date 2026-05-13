"""Apply Agent — Uses Gemini 2.0 Flash to execute application plans via browser tools."""

import os
import uuid
from datetime import datetime, timezone

import httpx

from state.run_tracker import update_run_progress


BROWSER_WORKER_URL = os.getenv("BROWSER_WORKER_URL", "http://localhost:8002")


async def run_apply(application_plan: dict, session_id: str, run_id: str) -> dict:
    """Execute an application plan.

    Input: application_plan, session_id
    Output: application_run result with step_events
    """
    fields = application_plan.get("fields", [])
    step_events = []

    async with httpx.AsyncClient() as http:
        for field in fields:
            step_name = field.get("label", "unknown")
            field_type = field.get("type", "fill")
            ref = field.get("ref", "")
            value = field.get("value", "")

            event = {
                "id": str(uuid.uuid4()),
                "run_id": run_id,
                "step_name": step_name,
                "tool_name": field_type,
                "tool_args": field,
                "success": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

            try:
                if field_type == "fill":
                    resp = await http.post(
                        f"{BROWSER_WORKER_URL}/fill",
                        json={"ref": ref, "value": value, "session_id": session_id},
                    )
                elif field_type == "select":
                    resp = await http.post(
                        f"{BROWSER_WORKER_URL}/fill",
                        json={"ref": ref, "value": value, "session_id": session_id},
                    )
                elif field_type == "click":
                    resp = await http.post(
                        f"{BROWSER_WORKER_URL}/click",
                        json={"ref": ref, "session_id": session_id},
                    )
                elif field_type == "upload":
                    resp = await http.post(
                        f"{BROWSER_WORKER_URL}/upload",
                        json={"ref": ref, "file_path": value, "session_id": session_id},
                    )
                else:
                    resp = await http.post(
                        f"{BROWSER_WORKER_URL}/fill",
                        json={"ref": ref, "value": value, "session_id": session_id},
                    )

                event["tool_output"] = resp.text[:2000]
                event["success"] = resp.status_code < 400
            except Exception as e:
                event["error_message"] = str(e)[:500]
                event["success"] = False

            # Screenshot after each step
            try:
                ss_resp = await http.post(
                    f"{BROWSER_WORKER_URL}/screenshot",
                    json={"path": f"/tmp/screenshots/{run_id}_{step_name}.png", "session_id": session_id},
                )
                event["screenshot_url"] = ss_resp.text
            except Exception:
                pass

            step_events.append(event)
            await update_run_progress(run_id, step_name, {"success": event["success"]})

    return {
        "agent": "apply",
        "run_id": run_id,
        "steps_executed": len(step_events),
        "step_events": step_events,
        "status": "success" if all(e["success"] for e in step_events) else "failed",
    }
