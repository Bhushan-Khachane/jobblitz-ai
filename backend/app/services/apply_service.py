from __future__ import annotations

import asyncio
import random
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path

from playwright.async_api import Page, async_playwright
from playwright_stealth import stealth_async

from app.config import settings
from app.services.ai_service import answer_question
from app.utils.encryption import decrypt


VIEWPORT_MIN = 1280
VIEWPORT_MAX = 1920


async def _random_delay(low: float = 1.0, high: float = 3.0) -> None:
    await asyncio.sleep(random.uniform(low, high))


async def _save_screenshot(page: Page, user_id: uuid.UUID, label: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    path = Path(settings.SCREENSHOT_DIR) / str(user_id) / f"{label}_{ts}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    await page.screenshot(path=str(path), full_page=True)
    return str(path)


async def login_with_credentials(
    platform: str,
    username: str,
    encrypted_password: str,
    user_data_dir: str | Path,
) -> tuple[bool, str]:
    """Log in to LinkedIn or Naukri using credentials. Returns (success, error_message)."""
    password = decrypt(encrypted_password)
    data_dir = Path(user_data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as pw:
        width = random.randint(VIEWPORT_MIN, VIEWPORT_MAX)
        height = random.randint(800, 1080)
        context = await pw.chromium.launch_persistent_context(
            user_data_dir=str(data_dir),
            headless=True,
            viewport={"width": width, "height": height},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            args=["--disable-blink-features=AutomationControlled"],
        )
        try:
            page = await context.new_page()
            await stealth_async(page)

            if platform == "linkedin":
                ok = await _login_linkedin(page, username, password)
            elif platform == "naukri":
                ok = await _login_naukri(page, username, password)
            else:
                return False, f"Unsupported platform: {platform}"

            if not ok:
                return False, f"Login failed for {platform}"
            return True, ""
        finally:
            await context.close()


async def _login_linkedin(page: Page, username: str, password: str) -> bool:
    await page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded", timeout=30000)
    await _random_delay()
    await page.fill("#username", username)
    await _random_delay(0.3, 0.8)
    await page.fill("#password", password)
    await _random_delay(0.5, 1.0)
    await page.click('button[type="submit"]')
    await _random_delay(3, 5)
    # Check for feed page or challenge
    url = page.url
    if "feed" in url or "mynetwork" in url:
        return True
    if "challenge" in url or "checkpoint" in url:
        return False
    return "login" not in url


async def _login_naukri(page: Page, username: str, password: str) -> bool:
    await page.goto("https://www.naukri.com/nlogin/login", wait_until="domcontentloaded", timeout=30000)
    await _random_delay()
    await page.fill("#usernameField, input[name='email'], input[placeholder*='Email']", username)
    await _random_delay(0.3, 0.8)
    await page.fill("#passwordField, input[name='password'], input[placeholder*='Password']", password)
    await _random_delay(0.5, 1.0)
    await page.click('button[type="submit"], .loginButton, #loginButton')
    await _random_delay(3, 5)
    url = page.url
    if "nlogin" not in url and "login" not in url.lower():
        return True
    return False


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
        tag = await inp.evaluate("el => el.tagName")
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


async def _handle_questions(page: Page, user_id: uuid.UUID, profile: dict, db_session=None) -> dict[str, str]:
    """Find and answer text-area / input questions using AI."""
    answered: dict[str, str] = {}
    textareas = await page.query_selector_all("textarea")
    for ta in textareas:
        label = (await ta.get_attribute("aria-label")) or (await ta.get_attribute("placeholder")) or ""
        name = (await ta.get_attribute("name")) or ""
        question = label or name
        if not question:
            continue
        current_val = (await ta.input_value()).strip()
        if current_val:
            continue
        # Try AI answer
        try:
            profile_text = (
                f"Name: {profile.get('full_name', '')}\n"
                f"Headline: {profile.get('headline', '')}\n"
                f"Skills: {profile.get('skills', '')}\n"
                f"Experience: {profile.get('experience', '')}\n"
                f"Education: {profile.get('education', '')}"
            )
            ans = await answer_question(question, profile_text)
            await ta.fill("")
            await _random_delay(0.2, 0.5)
            await ta.type(ans[:2000], delay=random.randint(20, 60))
            answered[question] = ans[:500]
            await _random_delay(0.5, 1.0)
        except Exception:
            continue
    return answered


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
    db_session=None,
) -> tuple[bool, dict[str, str], str | None]:
    """
    Fill an application form on the current page.
    Returns (success, answers_used, error_message).
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

        # Answer unknown questions with AI
        answers = await _handle_questions(page, user_id, profile, db_session)

        return True, answers, None
    except Exception as e:
        return False, {}, str(e)


async def submit_application(page: Page) -> tuple[bool, str | None]:
    """Click the submit/apply button. Returns (success, error)."""
    selectors = [
        'button[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Apply")',
        'button:has-text("Send")',
        'input[type="submit"]',
        ".apply-button",
        "#submit-application",
    ]
    for sel in selectors:
        try:
            btn = await page.query_selector(sel)
            if btn and await btn.is_visible():
                await _random_delay(0.5, 1.5)
                await btn.click()
                await _random_delay(3, 5)
                return True, None
        except Exception:
            continue
    return False, "No submit button found"


async def apply_to_job(
    apply_url: str,
    user_id: uuid.UUID,
    profile: dict,
    platform: str,
    username: str,
    encrypted_password: str,
    resume_path: str | None = None,
    cover_letter: str | None = None,
) -> tuple[bool, str | None, str | None, dict[str, str]]:
    """
    Full application flow: open page, fill form, submit.
    Returns (success, error, screenshot_path, answers_used).
    """
    ctx_dir = Path(settings.UPLOAD_DIR) / f".ctx_{user_id}_{platform}"
    ctx_dir.mkdir(parents=True, exist_ok=True)
    screenshot_path: str | None = None
    answers: dict[str, str] = {}

    async with async_playwright() as pw:
        width = random.randint(VIEWPORT_MIN, VIEWPORT_MAX)
        height = random.randint(800, 1080)
        context = await pw.chromium.launch_persistent_context(
            user_data_dir=str(ctx_dir),
            headless=True,
            viewport={"width": width, "height": height},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            args=["--disable-blink-features=AutomationControlled"],
        )
        try:
            page = await context.new_page()
            await stealth_async(page)

            # Navigate to the job
            await page.goto(apply_url, wait_until="domcontentloaded", timeout=30000)
            await _random_delay(2, 4)

            # If requires login, attempt login
            if "login" in page.url.lower() or "signin" in page.url.lower():
                password = decrypt(encrypted_password)
                if platform == "linkedin":
                    ok = await _login_linkedin(page, username, password)
                elif platform == "naukri":
                    ok = await _login_naukri(page, username, password)
                else:
                    return False, "Unknown platform", None, {}
                if not ok:
                    screenshot_path = await _save_screenshot(page, user_id, "login_failed")
                    return False, "Login failed", screenshot_path, {}
                await page.goto(apply_url, wait_until="domcontentloaded", timeout=30000)
                await _random_delay(2, 4)

            # Fill the form
            fill_ok, answers, fill_err = await fill_application_form(
                page, profile, resume_path, cover_letter, user_id
            )
            if not fill_ok:
                screenshot_path = await _save_screenshot(page, user_id, "fill_failed")
                return False, f"Form fill error: {fill_err}", screenshot_path, answers

            # Submit
            sub_ok, sub_err = await submit_application(page)
            if not sub_ok:
                screenshot_path = await _save_screenshot(page, user_id, "submit_failed")
                return False, f"Submit error: {sub_err}", screenshot_path, answers

            await _random_delay(2, 3)
            screenshot_path = await _save_screenshot(page, user_id, "success")
            return True, None, screenshot_path, answers

        except Exception as e:
            try:
                page_obj = context.pages[0] if context.pages else None
                if page_obj:
                    screenshot_path = await _save_screenshot(page_obj, user_id, "exception")
            except Exception:
                pass
            return False, str(e), screenshot_path, answers
        finally:
            await context.close()
