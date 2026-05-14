"""ADK Orchestrator — Intelligence Plane FastAPI service."""

import uuid
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel, Field

from agents.apply_agent import run_apply
from agents.coordinator import run_workflow
from agents.cover_letter_agent import generate as generate_cover_letter
from agents.discovery_agent import run_discovery
from agents.planner_agent import run_planner
from agents.screening_agent import run_screening
from agents.status_sync_agent import run_status_sync
from agents.verification_agent import run_verification
from config.llm import test_llm_connection
from state.run_tracker import get_run_status, set_run_status


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify LLM connection (non-fatal — service starts even if LLM is down)
    try:
        result = await test_llm_connection()
        if result["status"] != "ok":
            import logging
            logging.warning(f"LLM connection failed on startup: {result}")
    except Exception as e:
        import logging
        logging.warning(f"LLM client initialization warning: {e}")
    yield
    # Shutdown


app = FastAPI(
    title="JobBlitz ADK Orchestrator",
    description="Intelligence Plane for 3-plane architecture",
    version="1.0.0",
    lifespan=lifespan,
)


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "adk-orchestrator"}


# ── Cover Letter Task ────────────────────────────────────────────────────────

class CoverLetterRequest(BaseModel):
    user_id: str
    job: dict
    profile: dict


@app.post("/tasks/cover-letter")
async def cover_letter_endpoint(body: CoverLetterRequest):
    """Generate a cover letter and screening answers for a job."""
    result = await generate_cover_letter(body.user_id, body.job, body.profile)
    return result


# ── Discovery Task ───────────────────────────────────────────────────────────

class DiscoveryTaskRequest(BaseModel):
    search_id: str
    keywords: str
    location: str = "India"


@app.post("/tasks/discover")
async def discovery_task_endpoint(body: DiscoveryTaskRequest):
    """Run discovery via public job APIs."""
    search_profile = {
        "id": body.search_id,
        "keywords": body.keywords,
        "location": body.location,
        "portal": "naukri",
    }
    result = await run_discovery(search_profile, "default")
    return {"status": "ok", "result": result}


@app.get("/agent/test-gemini")
async def test_llm():
    """Quick LLM connectivity check. Tests whichever provider is active."""
    result = await test_llm_connection()
    if result["status"] == "ok":
        return result
    raise HTTPException(status_code=503, detail=result)


# ── Request Models ───────────────────────────────────────────────────────────

class AgentRunRequest(BaseModel):
    agent: str = Field(pattern="^(discovery|screening|planner|apply|verification|status_sync|workflow)$")
    user_id: str | None = None
    portal: str | None = None
    search_profile: dict | None = None
    job_lead: dict | None = None
    job_lead_ids: list | None = None
    user_profile: dict | None = None
    resume_text: str = ""
    fit_score: float | None = Field(None, ge=0, le=100)
    session_id: str | None = None
    plan_id: str | None = None
    run_id: str | None = None
    dry_run: bool = False
    expected_signals: list[str] | None = None


class DiscoveryRequest(BaseModel):
    search_profile: dict
    session_id: str


class ScreeningRequest(BaseModel):
    job_lead: dict
    user_profile: dict
    resume_text: str = ""


class PlannerRequest(BaseModel):
    job_lead: dict
    user_profile: dict
    fit_score: float = Field(ge=0, le=100)
    session_id: str


class WorkflowRequest(BaseModel):
    search_profile: dict
    user_profile: dict
    resume_text: str = ""
    session_id: str


class VerificationRequest(BaseModel):
    run_id: str
    session_id: str
    expected_signals: list[str] | None = None


class StatusSyncRequest(BaseModel):
    user_id: str
    portal: str = Field(pattern="^(naukri|linkedin|indeed|shine|unstop|wellfound|internshala)$")
    session_id: str


# ── Unified Agent Run Endpoint ─────────────────────────────────────────────────

async def _execute_agent(payload: AgentRunRequest) -> dict:
    agent = payload.agent
    run_id = payload.run_id or str(uuid.uuid4())

    if agent == "discovery":
        result = await run_discovery(payload.search_profile or {}, payload.session_id or "default")
    elif agent == "screening":
        result = await run_screening(payload.job_lead or {}, payload.user_profile or {}, payload.resume_text)
    elif agent == "planner":
        result = await run_planner(payload.job_lead or {}, payload.user_profile or {}, payload.fit_score or 0, payload.session_id or "default")
    elif agent == "apply":
        # plan payload arrives in search_profile field from backend dispatcher
        application_plan = payload.search_profile or {"fields": []}
        result = await run_apply(application_plan, payload.session_id or "default", run_id, payload.dry_run)
    elif agent == "verification":
        result = await run_verification(payload.run_id or run_id, payload.session_id or "default", payload.expected_signals)
    elif agent == "status_sync":
        result = await run_status_sync(payload.user_id or "", payload.portal or "naukri", payload.session_id or "default")
    elif agent == "workflow":
        result = await run_workflow(payload.search_profile or {}, payload.user_profile or {}, payload.resume_text, payload.session_id or "default")
    else:
        raise ValueError(f"Unknown agent: {agent}")

    result["run_id"] = run_id
    await set_run_status(run_id, result.get("status", "completed"), result)
    return result


@app.post("/agent/run")
async def run_agent_endpoint(body: AgentRunRequest, background_tasks: BackgroundTasks):
    """Queue an agent run and return immediately with run_id."""
    run_id = str(uuid.uuid4())
    await set_run_status(run_id, "queued", {"agent": body.agent})
    body_dict = body.model_copy(update={"run_id": run_id})
    background_tasks.add_task(_execute_agent, body_dict)
    return {"run_id": run_id, "status": "queued"}


@app.get("/agent/run/{run_id}/status")
async def get_agent_run_status(run_id: str):
    status = await get_run_status(run_id)
    return status


# ── Legacy Direct Agent Endpoints ────────────────────────────────────────────

@app.post("/agents/discovery")
async def discovery_endpoint(body: DiscoveryRequest):
    result = await run_discovery(body.search_profile, body.session_id)
    return {"status": "ok", "result": result}


@app.post("/agents/screening")
async def screening_endpoint(body: ScreeningRequest):
    result = await run_screening(body.job_lead, body.user_profile, body.resume_text)
    return {"status": "ok", "result": result}


@app.post("/agents/planner")
async def planner_endpoint(body: PlannerRequest):
    result = await run_planner(body.job_lead, body.user_profile, body.fit_score, body.session_id)
    return {"status": "ok", "result": result}


@app.post("/agents/verification")
async def verification_endpoint(body: VerificationRequest):
    result = await run_verification(body.run_id, body.session_id, body.expected_signals)
    return {"status": "ok", "result": result}


@app.post("/agents/status-sync")
async def status_sync_endpoint(body: StatusSyncRequest):
    result = await run_status_sync(body.user_id, body.portal, body.session_id)
    return {"status": "ok", "result": result}


@app.post("/agents/workflow")
async def workflow_endpoint(body: WorkflowRequest):
    result = await run_workflow(body.search_profile, body.user_profile, body.resume_text, body.session_id)
    return {"status": "ok", "result": result}
