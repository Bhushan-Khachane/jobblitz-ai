"""
Resume Translator router — replicates AIApply's 50-language resume translation.

  GET  /resume-translator/languages     — list supported languages
  POST /resume-translator/translate     — translate a resume
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.services.resume_translator_service import resume_translator_service

router = APIRouter(prefix="/resume-translator", tags=["resume-translator"])


class TranslateRequest(BaseModel):
    resume_text: str
    target_language: str
    polish_tone: bool = True


@router.get("/languages", summary="List supported languages")
async def list_languages(
    current_user: Any = Depends(get_current_user),
) -> list[dict[str, str]]:
    return resume_translator_service.supported_languages()


@router.post("/translate", summary="Translate resume to target language")
async def translate_resume(
    req: TranslateRequest,
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    return await resume_translator_service.translate(
        resume_text=req.resume_text,
        target_language=req.target_language,
        polish_tone=req.polish_tone,
    )
