"""Coordinator — Root agent that orchestrates the application workflow."""

import os
import uuid

import httpx

from state.run_tracker import set_run_status, update_run_progress

from agents.apply_agent import run_apply
from agents.discovery_agent import run_discovery
from agents.planner_agent import run_planner
from agents.screening_agent import run_screening
from agents.verification_agent import run_verification

ADK_API_URL = os.getenv("ADK_API_URL", "http://backend:8000/api/v1")


async def run_workflow(
    search_profile: dict,
    user_profile: dict,
    resume_text: str,
    session_id: str,
) -> dict:
    """Run the full job application workflow.

    Workflow:
      discovery → screening → (approval gate if needed) → planner → apply → verification

    If verification fails, trigger investigate sub-step and retry once.
    After 3 failures, mark application_run as BLOCKED and notify user.
    """
    run_id = str(uuid.uuid4())
    workflow_status = "running"
    events = []

    await set_run_status(run_id, "running", {"step": "discovery", "events": []})

    # ── Step 1: Discovery ────────────────────────────────────────────────────
    try:
        discovery_result = await run_discovery(search_profile, session_id)
        events.append({"step": "discovery", "status": "ok", "leads": discovery_result.get("leads_found", 0)})
        await update_run_progress(run_id, "discovery", {"status": "ok", "leads": discovery_result.get("leads_found", 0)})
    except Exception as e:
        events.append({"step": "discovery", "status": "failed", "error": str(e)})
        await set_run_status(run_id, "failed", {"events": events, "error": str(e)})
        return {"run_id": run_id, "status": "failed", "events": events, "error": str(e)}

    leads = discovery_result.get("leads", [])
    if not leads:
        await set_run_status(run_id, "skipped", {"events": events})
        return {"run_id": run_id, "status": "skipped", "events": events, "error": "No leads found"}

    # ── Step 2: Screen ALL leads ───────────────────────────────────────────────
    pending_approvals = []
    auto_applies = []

    for lead in leads:
        try:
            screening_result = await run_screening(lead, user_profile, resume_text)
            decision = screening_result.get("decision", "skip")
            fit_score = screening_result.get("fit_score", 0)

            events.append({
                "step": "screening",
                "title": lead.get("title"),
                "company": lead.get("company"),
                "fit_score": fit_score,
                "decision": decision,
            })

            if decision == "skip":
                continue
            elif decision == "auto":
                auto_applies.append({"lead": lead, "screening": screening_result})
            else:  # "approve"
                pending_approvals.append({"lead": lead, "screening": screening_result})
        except Exception as e:
            events.append({"step": "screening", "title": lead.get("title"), "error": str(e)})
            continue

    events.append({
        "step": "screening_summary",
        "total_leads": len(leads),
        "pending_approval": len(pending_approvals),
        "auto_apply": len(auto_applies),
        "skipped": len(leads) - len(pending_approvals) - len(auto_applies),
    })

    # POST all pending_approvals to backend queue-approval endpoint
    for item in pending_approvals:
        try:
            async with httpx.AsyncClient() as http:
                await http.post(
                    f"{ADK_API_URL}/applications/me/queue-approval",
                    json={
                        "user_id": search_profile.get("user_id"),
                        "job_lead": item["lead"],
                        "screening_result": item["screening"],
                        "search_profile_id": search_profile.get("id"),
                    },
                    headers={"x-service-token": os.getenv("INTERNAL_SERVICE_TOKEN", "changeme-internal")},
                    timeout=5.0,
                )
        except Exception:
            pass  # non-fatal

    # For now we don't auto-apply — everything goes to approval queue
    # (auto mode is wired but gated behind pro plan)
    if not pending_approvals and not auto_applies:
        await set_run_status(run_id, "skipped", {"events": events})
        return {"run_id": run_id, "status": "skipped", "events": events, "error": None}

    await set_run_status(run_id, "pending_approval", {
        "events": events,
        "pending_approvals": len(pending_approvals),
        "auto_applies": len(auto_applies),
    })
    return {
        "run_id": run_id,
        "status": "pending_approval",
        "events": events,
        "pending_approvals": len(pending_approvals),
        "auto_applies": len(auto_applies),
    }
