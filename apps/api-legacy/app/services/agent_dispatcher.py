"""Dispatch ADK agent tasks to the Intelligence Plane."""

import os

import httpx

from app.config import settings

ADK_URL = settings.ADK_ORCHESTRATOR_URL
DRY_RUN = os.getenv("DRY_RUN", "false").lower() == "true"


async def dispatch_discovery(user_id: str, portal: str, search_profile: dict) -> dict:
    import logging
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                f"{ADK_URL}/agent/run",
                json={
                    "agent": "discovery",
                    "user_id": str(user_id),
                    "portal": portal,
                    "search_profile": search_profile,
                },
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            logging.error(f"dispatch_discovery failed: {e.response.status_code} {e.response.text}")
            return {"run_id": None, "status": "error", "error": str(e)}
        except Exception as e:
            logging.error(f"dispatch_discovery exception: {e}")
            return {"run_id": None, "status": "error", "error": str(e)}


async def dispatch_workflow(
    user_id: str,
    portal: str,
    search_profile: dict,
    user_profile: dict,
    resume_text: str = "",
    pre_run_id: str | None = None,
) -> dict:
    """Dispatch the full workflow (discovery → screening → approval queue)."""
    import logging
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            payload = {
                "agent": "workflow",
                "user_id": str(user_id),
                "portal": portal,
                "search_profile": search_profile,
                "user_profile": user_profile,
                "resume_text": resume_text,
                "session_id": f"{user_id}_{portal}",
            }
            if pre_run_id:
                payload["run_id"] = pre_run_id
            resp = await client.post(f"{ADK_URL}/agent/run", json=payload)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            logging.error(f"dispatch_workflow failed: {e.response.status_code} {e.response.text}")
            return {"run_id": pre_run_id, "status": "error", "error": str(e)}
        except Exception as e:
            logging.error(f"dispatch_workflow exception: {e}")
            return {"run_id": pre_run_id, "status": "error", "error": str(e)}


async def dispatch_scoring(user_id: str, job_lead_ids: list[str]) -> dict:
    import logging
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                f"{ADK_URL}/agent/run",
                json={"agent": "screening", "user_id": str(user_id), "job_lead_ids": job_lead_ids},
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            logging.error(f"dispatch_scoring failed: {e.response.status_code} {e.response.text}")
            return {"run_id": None, "status": "error", "error": str(e)}
        except Exception as e:
            logging.error(f"dispatch_scoring exception: {e}")
            return {"run_id": None, "status": "error", "error": str(e)}


async def dispatch_apply(user_id: str, application_plan_id: str, plan_payload: dict | None = None, run_id: str | None = None) -> dict:
    import logging
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                f"{ADK_URL}/agent/run",
                json={
                    "agent": "apply",
                    "user_id": str(user_id),
                    "plan_id": application_plan_id,
                    "dry_run": DRY_RUN,
                    "search_profile": plan_payload or {},
                    "run_id": run_id,
                },
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            logging.error(f"dispatch_apply failed: {e.response.status_code} {e.response.text}")
            return {"run_id": run_id, "status": "error", "error": str(e)}
        except Exception as e:
            logging.error(f"dispatch_apply exception: {e}")
            return {"run_id": run_id, "status": "error", "error": str(e)}


async def get_run_status(run_id: str) -> dict:
    import logging
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{ADK_URL}/agent/run/{run_id}/status")
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logging.error(f"get_run_status exception: {e}")
        return {"status": "unknown", "error": str(e)}
