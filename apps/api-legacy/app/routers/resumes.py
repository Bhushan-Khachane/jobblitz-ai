from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Profile, Resume, User
from app.schemas import ResumeResponse, ResumeTailorRequest, ResumeTailorResponse, ResumeUpdate
from app.services.ai_service import (
    extract_resume_profile,
    resume_tailor,
    _to_str_list,
    _to_str,
    _to_int,
)
from app.services.pdf_service import generate_tailored_pdf, parse_pdf

router = APIRouter(prefix="/resumes", tags=["resumes"])


@router.get("/", response_model=list[ResumeResponse])
async def list_resumes(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Resume).where(Resume.user_id == user.id).order_by(Resume.created_at.desc()))
    return result.scalars().all()


@router.post("/upload", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    title: str | None = None,
    is_default: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are supported")

    user_dir = Path(settings.UPLOAD_DIR) / str(user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    file_path = user_dir / f"{uuid.uuid4().hex}_{file.filename}"

    content = await file.read()
    file_path.write_bytes(content)

    # Parse PDF text
    try:
        parsed = parse_pdf(file_path)
    except Exception:
        parsed = ""

    resume = Resume(
        user_id=user.id,
        title=title or file.filename,
        file_path=str(file_path),
        parsed_text=parsed,
        is_default=is_default,
    )

    if is_default:
        # Unset other defaults
        result = await db.execute(select(Resume).where(Resume.user_id == user.id, Resume.is_default))
        for r in result.scalars().all():
            r.is_default = False

    db.add(resume)
    await db.commit()
    await db.refresh(resume)

    # Extract structured profile from resume text
    if parsed:
        try:
            extracted = await extract_resume_profile(parsed)
            if extracted:
                await _upsert_profile(db, user.id, extracted)
        except Exception:
            pass  # Non-blocking: don't fail upload if extraction fails

    return resume


@router.post("/{resume_id}/tailor", response_model=ResumeTailorResponse)
async def tailor_resume(
    resume_id: uuid.UUID,
    body: ResumeTailorRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Resume).where(Resume.id == resume_id, Resume.user_id == user.id))
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    # Get resume text
    resume_text = resume.parsed_text or ""
    if not resume_text and resume.file_path:
        try:
            resume_text = parse_pdf(resume.file_path)
        except Exception:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not parse resume PDF")

    if not resume_text:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Resume has no extractable text")

    # AI tailor
    tailored = await resume_tailor(resume_text, body.job_description)

    # Generate PDF
    pdf_name = f"tailored_{uuid.uuid4().hex[:8]}.pdf"
    pdf_dir = Path(settings.UPLOAD_DIR) / str(user.id) / "tailored"
    pdf_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = pdf_dir / pdf_name
    generate_tailored_pdf(tailored, pdf_path)

    return ResumeTailorResponse(tailored_text=tailored, tailored_pdf_path=str(pdf_path))


@router.put("/{resume_id}", response_model=ResumeResponse)
async def update_resume(
    resume_id: uuid.UUID,
    body: ResumeUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Resume).where(Resume.id == resume_id, Resume.user_id == user.id))
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(resume, k, v)

    if body.is_default:
        # Unset other defaults
        result = await db.execute(select(Resume).where(Resume.user_id == user.id, Resume.is_default, Resume.id != resume_id))
        for r in result.scalars().all():
            r.is_default = False

    await db.commit()
    await db.refresh(resume)
    return resume


@router.post("/{resume_id}/analyze", status_code=status.HTTP_200_OK)
async def analyze_resume(
    resume_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-run AI extraction on an existing resume and update the user's Profile."""
    result = await db.execute(select(Resume).where(Resume.id == resume_id, Resume.user_id == user.id))
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    text = resume.parsed_text or ""
    if not text and resume.file_path:
        try:
            text = parse_pdf(resume.file_path)
        except Exception:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not parse resume PDF")

    if not text:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Resume has no extractable text")

    extracted = await extract_resume_profile(text)
    if not extracted:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not extract profile from resume")

    await _upsert_profile(db, user.id, extracted)
    return {"extracted": extracted}


async def _upsert_profile(db: AsyncSession, user_id: uuid.UUID, data: dict) -> None:
    """Create or update the user's Profile with extracted resume data."""
    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        profile = Profile(user_id=user_id)
        db.add(profile)

    if data.get("headline"):
        profile.headline = _to_str(data["headline"])
    if data.get("summary"):
        profile.summary = _to_str(data["summary"])
    if "skills" in data:
        profile.skills = _to_str_list(data["skills"])
    if "job_titles" in data:
        profile.preferred_job_titles = _to_str_list(data["job_titles"])
    if "experience" in data:
        profile.experience = _normalize_array(data["experience"])
    if "education" in data:
        profile.education = _normalize_array(data["education"])
    if "certifications" in data:
        profile.certifications = _normalize_array(data["certifications"])
    if data.get("experience_years") is not None:
        profile.experience_years = _to_int(data["experience_years"])
    if data.get("current_ctc_lpa") is not None:
        profile.current_ctc_lpa = _to_float(data["current_ctc_lpa"])
    if data.get("current_fixed_lpa") is not None:
        profile.current_fixed_lpa = _to_float(data["current_fixed_lpa"])
    if data.get("current_variable_lpa") is not None:
        profile.current_variable_lpa = _to_float(data["current_variable_lpa"])
    if "languages" in data:
        profile.languages = _to_str_list(data["languages"])
    if data.get("portfolio_url"):
        profile.portfolio_url = _to_str(data["portfolio_url"])
    if data.get("linkedin_url"):
        profile.linkedin_url = _to_str(data["linkedin_url"])
    if data.get("github_url"):
        profile.github_url = _to_str(data["github_url"])

    await db.commit()


def _normalize_array(val):
    """Ensure the LLM response is stored as a list, converting a single dict to a list if needed."""
    if val is None:
        return None
    if isinstance(val, list):
        return val
    if isinstance(val, dict):
        return [val]
    return [val]


def _to_float(val) -> float | None:
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    resume_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Resume).where(Resume.id == resume_id, Resume.user_id == user.id))
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    await db.delete(resume)
    await db.commit()
