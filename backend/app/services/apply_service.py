from __future__ import annotations

import asyncio
import logging
import random
import uuid
from datetime import datetime, timezone
from pathlib import Path

from playwright.async_api import Page

try:
    from playwright_stealth import stealth_async
except ImportError:  # pragma: no cover
    stealth_async = None

from app.config import settings
from app.services.ai_service import answer_question
from app.services.cover_letter_service import generate_unique_cover_letter
from app.services.extension_manager import extension_manager
from app.services.velocity_governor import can_apply, record_apply

logger = logging.getLogger(__name__)


VIEWPORT_MIN = 1280
VIEWPORT_MAX = 1920


async def _random_delay(low: float = 1.0, high: float = 3.0) -> None:
    await asyncio.sleep(random.uniform(low, high))


async def _save_screenshot(page: Page, user_id: uuid.UUID, label: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"{label}_{ts}.png"
    path = Path(settings.SCREENSHOT_DIR) / str(user_id) / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    await page.screenshot(path=str(path), full_page=True)

    # Attempt Supabase Storage upload (falls back to local path if unavailable)
    from app.services.storage import upload_to_storage
    public_url = await upload_to_storage(str(path), str(user_id), filename)
    return public_url or str(path)


async def login_with_credentials(
    platform: str,
    username: str,
    encrypted_password: str,
    user_data_dir: str | Path | None = None,
) -> tuple[bool, str]:
    """Login is handled via Playwright browser worker sessions.

    This function is retained as a stub for interface compatibility only.
    Password-based login is not supported in the zero-password architecture.
    """
    return False, "Password-based login is not supported — use browser worker sessions"


async def _detect_form_fields(page: Page) -> dict[str, str]:
    """Detect common form field selectors on job application pages."""
    field_map: dict[str, str] = {}
    inputs = await page.query_selector_all("input, textarea, select")
    for inp in inputs:
        name = (await inp.get_attribute("name")) or ""
        placeholder = (await inp.get_attribute("placeholder")) or ""
        aria = (await inp.get_attribute("aria-label")) or ""
        label_text = f"{name} {placeholder} {aria}".lower()

        if any(k in label_text for k in ["first name", "firstname", "fname"]):
            field_map["first_name"] = name or placeholder
        elif any(k in label_text for k in ["last name", "lastname", "lname", "surname"]):
            field_map["last_name"] = name or placeholder
        elif any(k in label_text for k in ["email", "e-mail"]):
            field_map["email"] = name or placeholder
        elif any(k in label_text for k in ["phone", "mobile", "telephone"]):
            field_map["phone"] = name or placeholder
        elif any(k in label_text for k in ["location", "city", "address"]):
            field_map["location"] = name or placeholder
        elif any(k in label_text for k in ["linkedin", "profile url"]):
            field_map["linkedin_url"] = name or placeholder
        elif any(k in label_text for k in ["website", "portfolio", "github"]):
            field_map["website"] = name or placeholder
        elif any(k in label_text for k in ["cover letter", "cover_letter", "message"]):
            field_map["cover_letter"] = name or placeholder
        elif any(k in label_text for k in ["salary", "compensation", "ctc", "expected"]):
            field_map["salary"] = name or placeholder
        elif any(k in label_text for k in ["notice", "joining", "availability"]):
            field_map["notice_period"] = name or placeholder

    return field_map


async def _fill_standard_fields(page: Page, profile: dict) -> None:
    """Fill detected standard fields from profile data."""
    inputs = await page.query_selector_all("input, textarea")
    for inp in inputs:
        name = ((await inp.get_attribute("name")) or "").lower()
        placeholder = ((await inp.get_attribute("placeholder")) or "").lower()
        aria = ((await inp.get_attribute("aria-label")) or "").lower()
        combined = f"{name} {placeholder} {aria}"
        input_type = (await inp.get_attribute("type")) or ""

        if input_type in ("hidden", "submit", "button", "checkbox", "radio"):
            continue

        value = None
        if any(k in combined for k in ["first name", "firstname"]):
            value = profile.get("first_name", "")
        elif any(k in combined for k in ["last name", "lastname", "surname"]):
            value = profile.get("last_name", "")
        elif any(k in combined for k in ["email", "e-mail"]):
            value = profile.get("email", "")
        elif any(k in combined for k in ["phone", "mobile"]):
            value = profile.get("phone", "")
        elif any(k in combined for k in ["location", "city"]):
            value = profile.get("location", "")

        if value:
            await inp.fill("")
            await _random_delay(0.2, 0.5)
            await inp.type(value, delay=random.randint(30, 80))
            await _random_delay(0.3, 0.8)


async def _handle_questions(
    page: Page,
    user_id: uuid.UUID,
    profile: dict,
    platform: str | None = None,
    db_session=None,
) -> tuple[dict[str, str], list[str]]:
    """Find and answer text-area / input questions.

    Returns:
        (answered_dict, unanswered_questions_list)
    """
    from app.services.questionnaire_defaults import get_default_answer
    from app.models import QuestionAnswer
    from sqlalchemy import select, func as sqlfunc
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    answered: dict[str, str] = {}
    unanswered: list[str] = []

    textareas = await page.query_selector_all("textarea")
    for ta in textareas:
        label = (await ta.get_attribute("aria-label")) or (await ta.get_attribute("placeholder")) or ""
        name = (await ta.get_attribute("name")) or ""
        question = (label or name).strip()
        if not question:
            continue
        current_val = (await ta.input_value()).strip()
        if current_val:
            continue

        ans: str | None = None
        source = "unknown"

        # 1. Try resume-derived default answer
        ans = get_default_answer(question, profile)
        if ans:
            source = "default"

        # 2. Try QuestionAnswer memory (exact match or fuzzy)
        if not ans and db_session:
            try:
                mem_result = await db_session.execute(
                    select(QuestionAnswer)
                    .where(
                        QuestionAnswer.user_id == user_id,
                        QuestionAnswer.platform == (platform or ""),
                    )
                    .where(
                        sqlfunc.lower(QuestionAnswer.question_text).like(f"%{question.lower()}%")
                        | sqlfunc.lower(QuestionAnswer.question_text).ilike(f"%{question.lower()}%")
                    )
                    .order_by(QuestionAnswer.usage_count.desc())
                    .limit(1)
                )
                mem = mem_result.scalar_one_or_none()
                if mem:
                    ans = mem.answer_text
                    source = "memory"
                    mem.usage_count += 1
                    await db_session.commit()
            except Exception:
                pass

        # 3. Fallback to LLM
        if not ans:
            try:
                profile_text = (
                    f"Name: {profile.get('full_name', '')}\n"
                    f"Headline: {profile.get('headline', '')}\n"
                    f"Skills: {profile.get('skills', '')}\n"
                    f"Experience: {profile.get('experience', '')}\n"
                    f"Education: {profile.get('education', '')}"
                )
                ans = await answer_question(question, profile_text)
                source = "llm"
            except Exception:
                pass

        if ans and ans.strip():
            try:
                await ta.fill("")
                await _random_delay(0.2, 0.5)
                await ta.type(ans[:2000], delay=random.randint(20, 60))
                answered[question] = ans[:500]
                await _random_delay(0.5, 1.0)
            except Exception:
                pass

            # Persist LLM-generated answers to QuestionAnswer memory
            if source == "llm" and db_session:
                try:
                    stmt = pg_insert(QuestionAnswer).values(
                        user_id=user_id,
                        question_text=question,
                        answer_text=ans[:2000],
                        platform=platform or "",
                        usage_count=1,
                    ).on_conflict_do_nothing(
                        index_elements=["user_id", "question_text", "platform"]
                    )
                    await db_session.execute(stmt)
                    await db_session.commit()
                except Exception:
                    pass
        else:
            unanswered.append(question)

    return answered, unanswered


async def _upload_resume_to_field(page: Page, resume_path: str) -> bool:
    """Try to upload a resume file to the page."""
    file_inputs = await page.query_selector_all("input[type='file']")
    if not file_inputs:
        return False
    for fi in file_inputs:
        try:
            await fi.set_input_files(resume_path)
            await _random_delay(1, 2)
            return True
        except Exception:
            continue
    return False


async def fill_application_form(
    page: Page,
    profile: dict,
    resume_path: str | None,
    cover_letter: str | None,
    user_id: uuid.UUID,
    platform: str | None = None,
    db_session=None,
) -> tuple[bool, dict[str, str], list[str], str | None]:
    """
    Fill an application form on the current page.
    Returns (success, answered_questions, unanswered_questions, error_message).
    """
    try:
        await _random_delay(1, 2)

        # Upload resume if file input present
        if resume_path and Path(resume_path).exists():
            await _upload_resume_to_field(page, resume_path)

        # Fill standard fields
        await _fill_standard_fields(page, profile)

        # Fill cover letter textarea if present and we have one
        if cover_letter:
            textareas = await page.query_selector_all("textarea")
            for ta in textareas:
                name = ((await ta.get_attribute("name")) or "").lower()
                placeholder = ((await ta.get_attribute("placeholder")) or "").lower()
                if any(k in f"{name} {placeholder}" for k in ["cover", "message", "additional"]):
                    current = (await ta.input_value()).strip()
                    if not current:
                        await ta.fill(cover_letter[:3000])
                        await _random_delay(0.5, 1.0)
                        break

        # Answer unknown questions with AI / memory / defaults
        answers, unanswered = await _handle_questions(page, user_id, profile, platform, db_session)

        return True, answers, unanswered, None
    except Exception as e:
        return False, {}, [], str(e)


async def _click_apply_on_page(page: Page) -> tuple[bool, str | None]:
    """Try to click an Apply / Apply Now button."""
    selectors = [
        'button:has-text("Apply")',
        'button:has-text("Apply Now")',
        'a:has-text("Apply")',
        'a:has-text("Apply Now")',
        "[id*='apply']",
        "[class*='apply']",
        ".apply-button",
        'button[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Send")',
        'input[type="submit"]',
        "#submit-application",
    ]
    for sel in selectors:
        try:
            btn = await page.query_selector(sel)
            if btn and await btn.is_visible():
                await _random_delay(0.5, 1.5)
                await btn.scroll_into_view_if_needed()
                await btn.click()
                await _random_delay(3, 5)
                return True, None
        except Exception:
            continue
    return False, "No apply button found"


async def _is_naukri_login_required(page: Page) -> bool:
    """Detect if Naukri job page requires login before applying."""
    login_btn = await page.query_selector('button:has-text("Login to Apply")')
    if login_btn and await login_btn.is_visible():
        return True
    # Also check page content for common login-wall text
    body = await page.content()
    return "login to apply" in body.lower() or "login and apply" in body.lower()


async def _is_naukri_external_apply(page: Page) -> bool:
    """Detect if the job requires applying on the company's own site."""
    ext_btn = await page.query_selector('button:has-text("Apply on company site")')
    if ext_btn and await ext_btn.is_visible():
        return True
    body = await page.content()
    return "apply on company site" in body.lower()


async def _apply_naukri(
    page: Page,
    profile: dict,
    resume_path: str | None,
    cover_letter: str | None,
    user_id: uuid.UUID,
    username: str,
    encrypted_password: str,
    db_session=None,
) -> tuple[bool, str | None, dict[str, str]]:
    """Naukri-specific apply flow."""
    answers: dict[str, str] = {}

    # Ensure we are logged in first — login is handled via Neko cloud browser sessions
    if await _is_naukri_login_required(page):
        return False, "Naukri login required — connect via Neko cloud browser first", {}

    # Skip jobs that redirect to external company sites — too complex to automate
    if await _is_naukri_external_apply(page):
        return False, "External apply — company site", {}

    # Click the Apply / Apply Now button on the job page
    clicked, click_err = await _click_apply_on_page(page)
    if not clicked:
        return False, click_err, {}

    # Wait for any inline form / modal to appear
    await _random_delay(2, 4)

    # Check for confirmation modal / success message
    body = await page.content()
    if any(msg in body.lower() for msg in [
        "successfully applied",
        "application submitted",
        "you have applied",
        "applied successfully",
    ]):
        return True, None, {}

    # Fill any form fields that appeared after clicking Apply
    fill_ok, answers, unanswered, fill_err = await fill_application_form(
        page, profile, resume_path, cover_letter, user_id, "naukri", db_session
    )
    if not fill_ok:
        return False, f"Form fill error: {fill_err}", {"answered": answers, "unanswered": unanswered}

    # If there are unanswered questions, mark as assisted so user can provide answers
    if unanswered:
        return True, None, {"answered": answers, "unanswered": unanswered, "needs_user_input": True}

    # Try clicking submit on the form/modal
    sub_ok, sub_err = await _click_apply_on_page(page)
    if not sub_ok:
        return False, f"Submit error: {sub_err}", {"answered": answers, "unanswered": unanswered}

    await _random_delay(2, 3)
    return True, None, {"answered": answers, "unanswered": unanswered}


async def submit_application(page: Page) -> tuple[bool, str | None]:
    """Click the submit/apply button. Returns (success, error)."""
    return await _click_apply_on_page(page)


async def apply_to_job(
    apply_url: str,
    user_id: uuid.UUID,
    profile: dict,
    platform: str,
    username: str,
    encrypted_password: str,
    resume_path: str | None = None,
    cover_letter: str | None = None,
    job_title: str | None = None,
    company: str | None = None,
    job_description: str | None = None,
    application_id: str | None = None,
) -> tuple[bool, str | None, str | None, dict[str, str]]:
    """
    Full application flow with extension-first dispatch and Playwright fallback.
    Returns (success, error, screenshot_path, answers_used).
    """
    # 1. Rate limit check
    allowed, reason = await can_apply(str(user_id), platform)
    if not allowed:
        return False, reason, None, {}

    # 2. Generate unique cover letter if missing and job context is available
    if not cover_letter and job_title and company and job_description:
        try:
            user_resume_summary = (
                f"Name: {profile.get('full_name', '')}\n"
                f"Headline: {profile.get('headline', '')}\n"
                f"Skills: {profile.get('skills', '')}\n"
                f"Experience: {profile.get('experience', '')}"
            )
            cover_letter = await generate_unique_cover_letter(
                user_id=str(user_id),
                job_title=job_title,
                company=company,
                job_description=job_description,
                user_resume_summary=user_resume_summary,
            )
        except Exception as e:
            logger.warning(f"Cover letter generation failed: {e}")

    # 3. Try browser extension dispatch first
    if extension_manager.is_connected(str(user_id)):
        payload = {
            "apply_url": apply_url,
            "platform": platform,
            "profile": profile,
            "resume_path": resume_path,
            "cover_letter": cover_letter,
            "application_id": application_id,
        }
        sent = await extension_manager.send_apply_job(str(user_id), payload)
        if sent:
            await record_apply(str(user_id), platform)
            return True, None, None, {}

    # 4. Fallback to server-side Playwright
    screenshot_path: str | None = None
    answers: dict[str, str] = {}

    from app.services.browser_pool import browser_pool
    ctx = await browser_pool.acquire_for_user(str(user_id), task_type=f"{platform}_apply")
    try:
        page = await ctx.new_page()
        try:
            if stealth_async and platform != "naukri":
                await stealth_async(page)

            await page.goto(apply_url, wait_until="domcontentloaded", timeout=30000)
            await _random_delay(2, 4)

            if "login" in page.url.lower() or "signin" in page.url.lower():
                screenshot_path = await _save_screenshot(page, user_id, "login_required")
                return False, "Login required — connect via Neko cloud browser first", screenshot_path, {}

            if platform == "naukri":
                naukri_ok, naukri_err, answers = await _apply_naukri(
                    page, profile, resume_path, cover_letter, user_id, username, encrypted_password
                )
                if not naukri_ok:
                    screenshot_path = await _save_screenshot(page, user_id, "submit_failed")
                    return False, naukri_err, screenshot_path, answers
            else:
                fill_ok, answers, fill_err = await fill_application_form(
                    page, profile, resume_path, cover_letter, user_id
                )
                if not fill_ok:
                    screenshot_path = await _save_screenshot(page, user_id, "fill_failed")
                    return False, f"Form fill error: {fill_err}", screenshot_path, answers

                sub_ok, sub_err = await submit_application(page)
                if not sub_ok:
                    screenshot_path = await _save_screenshot(page, user_id, "submit_failed")
                    return False, f"Submit error: {sub_err}", screenshot_path, answers

            await _random_delay(2, 3)
            screenshot_path = await _save_screenshot(page, user_id, "success")
            await record_apply(str(user_id), platform)
            return True, None, screenshot_path, answers

        except Exception as e:
            try:
                screenshot_path = await _save_screenshot(page, user_id, "exception")
            except Exception:
                pass
            return False, str(e), screenshot_path, answers
        finally:
            await page.close()
    finally:
        await browser_pool.release(ctx)