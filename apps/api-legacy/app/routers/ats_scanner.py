"""
ATS Scanner router — replicates AIApply's ATS Resume Checker.

  POST /ats-scanner/scan          — full ATS scan
  POST /ats-scanner/quick-score   — fast match score only
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.services.ats_scanner_service import ats_scanner_service

router = APIRouter(prefix="/ats-scanner", tags=["ats-scanner"])


class ATSScanRequest(BaseModel):
    resume_text: str
    jd_text: str
    target_role: str = ""


class QuickScoreRequest(BaseModel):
    resume_text: str
    jd_text: str


@router.post("/scan", summary="Full ATS keyword + section analysis")
async def full_scan(
    req: ATSScanRequest,
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    return await ats_scanner_service.scan(
        resume_text=req.resume_text,
        jd_text=req.jd_text,
        target_role=req.target_role,
    )


@router.post("/quick-score", summary="Fast ATS match score (0-100)")
async def quick_score(
    req: QuickScoreRequest,
    current_user: Any = Depends(get_current_user),
) -> dict[str, int]:
    score = await ats_scanner_service.quick_score(
        resume_text=req.resume_text,
        jd_text=req.jd_text,
    )
    return {"score": score}
