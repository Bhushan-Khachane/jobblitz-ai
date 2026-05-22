"""
Interview Hub router — provides endpoints for:
  POST /interview/start          — start a mock interview session
  POST /interview/questions       — generate questions only
  POST /interview/score-answer    — score a submitted answer
  POST /interview/live-hint       — get a real-time coaching hint
  GET  /interview/company-brief   — fetch company intel (Perplexity-powered)
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.services.interview_service import interview_service

router = APIRouter(prefix="/interview", tags=["interview"])


# ── Request / Response models ─────────────────────────────────────────────── #

class StartSessionRequest(BaseModel):
    role: str
    company: str
    jd_text: str = ""
    resume_text: str = ""


class QuestionsRequest(BaseModel):
    role: str
    jd_text: str = ""
    resume_text: str = ""
    question_types: list[str] | None = None
    count: int = Field(default=10, ge=1, le=30)


class ScoreAnswerRequest(BaseModel):
    question: str
    answer: str
    role: str


class LiveHintRequest(BaseModel):
    question: str
    role: str
    partial_answer: str = ""


# ── Endpoints ─────────────────────────────────────────────────────────────── #

@router.post("/start", summary="Start a full mock interview session")
async def start_session(
    req: StartSessionRequest,
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    session = await interview_service.start_session(
        role=req.role,
        company=req.company,
        jd_text=req.jd_text,
        resume_text=req.resume_text,
    )
    return session


@router.post("/questions", summary="Generate tailored interview questions")
async def generate_questions(
    req: QuestionsRequest,
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    questions = await interview_service.generate_questions(
        role=req.role,
        jd_text=req.jd_text,
        resume_text=req.resume_text,
        question_types=req.question_types,
        count=req.count,
    )
    return {"questions": questions, "count": len(questions)}


@router.post("/score-answer", summary="Score a mock interview answer")
async def score_answer(
    req: ScoreAnswerRequest,
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    result = await interview_service.score_answer(
        question=req.question,
        answer=req.answer,
        role=req.role,
    )
    return result


@router.post("/live-hint", summary="Real-time coaching hint for live interview")
async def live_hint(
    req: LiveHintRequest,
    current_user: Any = Depends(get_current_user),
) -> dict[str, str]:
    hint = await interview_service.live_hint(
        question=req.question,
        role=req.role,
        partial_answer=req.partial_answer,
    )
    return {"hint": hint}


@router.get("/company-brief", summary="Fetch live company intel via Perplexity Sonar")
async def company_brief(
    company: str,
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    if not company.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="company name required")
    brief = await interview_service.company_brief(company)
    return brief
