"""Coordinator — Root agent that orchestrates the application workflow."""

import uuid

from state.run_tracker import set_run_status, update_run_progress

from agents.apply_agent import run_apply
from agents.discovery_agent import run_discovery
from agents.planner_agent import run_planner
from agents.screening_agent import run_screening
from agents.verification_agent import run_verification


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

    # Process first lead for demonstration
    lead = leads[0]

    # ── Step 2: Screening ────────────────────────────────────────────────────
    try:
        screening_result = await run_screening(lead, user_profile, resume_text)
        events.append({
            "step": "screening",
            "status": "ok",
            "fit_score": screening_result.get("fit_score"),
            "decision": screening_result.get("decision"),
        })
        await update_run_progress(run_id, "screening", {"status": "ok", "fit_score": screening_result.get("fit_score")})
    except Exception as e:
        events.append({"step": "screening", "status": "failed", "error": str(e)})
        await set_run_status(run_id, "failed", {"events": events, "error": str(e)})
        return {"run_id": run_id, "status": "failed", "events": events, "error": str(e)}

    decision = screening_result.get("decision", "skip")
    if decision == "skip":
        await set_run_status(run_id, "skipped", {"events": events})
        return {"run_id": run_id, "status": "skipped", "events": events, "error": None}

    # Approval gate
    requires_approval = decision == "approve" or screening_result.get("fit_score", 0) < 80
    if requires_approval:
        events.append({"step": "approval_gate", "status": "pending", "reason": "fit_score below auto threshold or decision=approve"})
        await set_run_status(run_id, "pending_approval", {"events": events, "screening_result": screening_result})
        return {
            "run_id": run_id,
            "status": "pending_approval",
            "events": events,
            "error": None,
            "screening_result": screening_result,
        }

    # ── Step 3: Planner ──────────────────────────────────────────────────────
    try:
        plan_result = await run_planner(lead, user_profile, screening_result.get("fit_score", 0), session_id)
        events.append({"step": "planner", "status": "ok", "requires_approval": plan_result.get("plan", {}).get("requires_approval", True)})
        await update_run_progress(run_id, "planner", {"status": "ok"})
    except Exception as e:
        events.append({"step": "planner", "status": "failed", "error": str(e)})
        await set_run_status(run_id, "failed", {"events": events, "error": str(e)})
        return {"run_id": run_id, "status": "failed", "events": events, "error": str(e)}

    plan = plan_result.get("plan", {})
    if plan.get("requires_approval"):
        events.append({"step": "approval_gate", "status": "pending", "reason": "plan requires approval"})
        await set_run_status(run_id, "pending_approval", {"events": events, "plan": plan})
        return {
            "run_id": run_id,
            "status": "pending_approval",
            "events": events,
            "error": None,
            "plan": plan,
        }

    # ── Step 4: Apply ──────────────────────────────────────────────────────────
    apply_result = None
    failures = 0
    max_failures = 3

    while failures < max_failures:
        try:
            apply_result = await run_apply(plan, session_id, run_id)
            events.append({"step": "apply", "status": apply_result.get("status"), "steps": apply_result.get("steps_executed", 0)})
            await update_run_progress(run_id, "apply", {"status": apply_result.get("status"), "steps": apply_result.get("steps_executed", 0)})
            break
        except Exception as e:
            failures += 1
            events.append({"step": "apply", "status": "failed", "attempt": failures, "error": str(e)})
            await update_run_progress(run_id, "apply", {"status": "failed", "attempt": failures, "error": str(e)})
            if failures >= max_failures:
                await set_run_status(run_id, "blocked", {"events": events, "error": f"Apply failed after {max_failures} attempts: {str(e)}"})
                return {
                    "run_id": run_id,
                    "status": "blocked",
                    "events": events,
                    "error": f"Apply failed after {max_failures} attempts: {str(e)}",
                }

    # ── Step 5: Verification ─────────────────────────────────────────────────
    try:
        verify_result = await run_verification(run_id, session_id)
        events.append({
            "step": "verification",
            "status": "ok" if verify_result.get("verified") else "failed",
            "verified": verify_result.get("verified"),
            "confidence": verify_result.get("confidence"),
        })
        await update_run_progress(run_id, "verification", {"verified": verify_result.get("verified"), "confidence": verify_result.get("confidence")})

        if not verify_result.get("verified"):
            # Retry once with investigate sub-step
            events.append({"step": "investigate", "status": "retrying"})
            await update_run_progress(run_id, "investigate", {"status": "retrying"})
            apply_retry = await run_apply(plan, session_id, run_id)
            events.append({"step": "apply_retry", "status": apply_retry.get("status")})
            await update_run_progress(run_id, "apply_retry", {"status": apply_retry.get("status")})

            verify_retry = await run_verification(run_id, session_id)
            events.append({
                "step": "verification_retry",
                "status": "ok" if verify_retry.get("verified") else "failed",
                "verified": verify_retry.get("verified"),
            })
            await update_run_progress(run_id, "verification_retry", {"verified": verify_retry.get("verified")})

            if not verify_retry.get("verified"):
                workflow_status = "failed"
            else:
                workflow_status = "success"
        else:
            workflow_status = "success"
    except Exception as e:
        events.append({"step": "verification", "status": "failed", "error": str(e)})
        await update_run_progress(run_id, "verification", {"status": "failed", "error": str(e)})
        workflow_status = "failed"

    await set_run_status(run_id, workflow_status, {"events": events})
    return {
        "run_id": run_id,
        "status": workflow_status,
        "events": events,
        "error": None,
    }
