from __future__ import annotations
import asyncio, uuid, json
from pathlib import Path
from datetime import datetime, timezone
from typing import AsyncGenerator

from browser_use import Agent, Browser, BrowserConfig
from langchain_openai import ChatOpenAI
from playwright.async_api import async_playwright

from app.config import settings
from app.utils.encryption import decrypt

import logging
logger = logging.getLogger(__name__)


def _get_llm():
    """Kimi K2 via Ollama Pro — OpenAI-compatible endpoint."""
    return ChatOpenAI(
        model="kimi-k2.6:cloud",
        base_url=getattr(settings, "OLLAMA_BASE_URL", "http://host.docker.internal:11434") + "/v1",
        api_key="ollama",
        temperature=0.0,
        max_tokens=8192,
        request_timeout=120,
    )


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


async def apply_to_job_with_agent(
    user_id: uuid.UUID,
    platform: str,
    username: str,
    encrypted_password: str,
    job_url: str,
    profile: dict,
    resume_path: str | None = None,
) -> AsyncGenerator[dict, None]:
    """
    Run browser-use agent to apply to a single job.
    Yields SSE-compatible progress event dicts.
    """
    password = decrypt(encrypted_password)
    screenshot_dir = Path(settings.SCREENSHOT_DIR) / str(user_id)
    screenshot_dir.mkdir(parents=True, exist_ok=True)

    login_url = (
        "https://www.naukri.com/nlogin/login"
        if platform == "naukri"
        else "https://www.linkedin.com/login"
    )

    resume_instruction = (
        f"Upload my resume file from this absolute path on disk: {resume_path}"
        if resume_path and Path(resume_path).exists()
        else "No resume file available — skip any file upload fields."
    )

    skills_text = ", ".join(profile.get("skills", []) if isinstance(profile.get("skills"), list)
                            else list(profile.get("skills", {}).keys()))

    task = f"""
You are a job application assistant. Complete these steps carefully:

STEP 1 — LOGIN:
Navigate to: {login_url}
Enter email: {username}
Enter password: {password}
Click the submit/login button.
Wait 5 seconds. Check if you are now on the home/dashboard page (URL should NOT contain "login").
If login failed, report: "STEP 1 FAILED: [exact error message on screen]" and stop.
If login succeeded, report: "STEP 1 DONE: Logged into {platform} successfully"

STEP 2 — NAVIGATE TO JOB:
Go to this URL: {job_url}
Wait for the page to fully load.
Report: "STEP 2 DONE: Job page loaded — [job title and company if visible]"

STEP 3 — CLICK APPLY:
Find and click the Apply / Easy Apply / Apply Now button.
If you see a multi-step modal or form opening, that is correct — proceed.
Report: "STEP 3 DONE: Apply form opened"

STEP 4 — FILL FORM:
Fill all visible fields using this profile:
  Full Name: {profile.get("full_name", "")}
  First Name: {profile.get("first_name", profile.get("full_name", "").split()[0] if profile.get("full_name") else "")}
  Last Name: {profile.get("last_name", " ".join(profile.get("full_name", "").split()[1:]))}
  Email: {profile.get("email", "")}
  Phone: {profile.get("phone", "")}
  Location / City: {profile.get("location", "")}
  Current or Expected CTC: {profile.get("expected_salary_lpa", "")} LPA
  Notice Period: {profile.get("notice_period_days", "")} days
  Professional Headline: {profile.get("headline", "")}
  Key Skills: {skills_text}

{resume_instruction}

For any "Years of experience" dropdowns, select the closest appropriate option.
Report: "STEP 4 DONE: Form filled"

STEP 5 — ANSWER SCREENING QUESTIONS:
If there are text areas or additional questions, answer them professionally and briefly
based on this summary: "{profile.get("summary", "Experienced professional seeking new opportunities.")}"
Keep each answer under 200 words.
Report: "STEP 5 DONE: Questions answered" or "STEP 5 SKIPPED: No questions found"

STEP 6 — SUBMIT:
Click the final Submit / Apply / Send Application button.
Wait for the confirmation/success page or message.
Report: "STEP 6 DONE: Application submitted — [confirmation message if any]"

RULES:
- If you encounter a CAPTCHA at any step, report: "CAPTCHA DETECTED" and stop immediately
- If a required field is missing from the profile data, leave it blank — do not invent data
- Do not navigate away from the application flow
- Take a screenshot only at the final step
"""

    yield {"event": "start", "message": f"Agent starting — {platform} application", "ts": _ts()}

    browser = Browser(config=BrowserConfig(headless=True))
    llm = _get_llm()
    agent = Agent(
        task=task,
        llm=llm,
        browser=browser,
        max_actions_per_step=6,
    )

    try:
        # Stream step callbacks
        step_num = 0

        async def on_step(step_info):
            nonlocal step_num
            step_num += 1
            action_desc = str(step_info)[:200] if step_info else f"Step {step_num}"
            # We yield via a queue since callbacks can't yield directly
            await step_queue.put({
                "event": "step",
                "step": step_num,
                "message": action_desc,
                "ts": _ts(),
            })

        step_queue: asyncio.Queue = asyncio.Queue()

        # Run agent — non-streaming, collect all steps
        history = await agent.run(max_steps=30)

        final_result = (history.final_result() or "").strip()

        # Emit each step from history
        for i, item in enumerate(history.history or [], start=1):
            action = getattr(item, "model_output", None)
            msg = str(action)[:200] if action else f"Step {i} completed"
            yield {"event": "step", "step": i, "message": msg, "ts": _ts()}

        # Determine success
        success_keywords = ["step 6 done", "submitted", "applied", "thank you", "confirmation",
                           "application sent", "success", "complete"]
        fail_keywords = ["failed", "captcha detected", "error", "unable", "could not", "blocked"]

        result_lower = final_result.lower()
        is_success = any(k in result_lower for k in success_keywords)
        is_failed = any(k in result_lower for k in fail_keywords)

        if is_failed:
            is_success = False

        # Save final screenshot
        screenshot_path = None
        try:
            page = await browser.get_current_page()
            if page:
                ts_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
                screenshot_path = str(screenshot_dir / f"apply_{ts_str}.png")
                await page.screenshot(path=screenshot_path, full_page=True)
        except Exception as ss_err:
            logger.warning(f"Screenshot failed: {ss_err}")

        yield {
            "event": "complete",
            "success": is_success,
            "result": final_result[:1000],
            "screenshot_path": screenshot_path,
            "steps_taken": len(history.history or []),
            "ts": _ts(),
        }

    except Exception as e:
        logger.error(f"Agent failed for user {user_id} on {job_url}: {e}", exc_info=True)
        yield {
            "event": "error",
            "success": False,
            "result": f"Agent exception: {str(e)[:500]}",
            "screenshot_path": None,
            "ts": _ts(),
        }
    finally:
        try:
            await browser.close()
        except Exception:
            pass


async def test_login_with_agent(
    platform: str,
    username: str,
    encrypted_password: str,
) -> tuple[bool, str]:
    """
    Verify login credentials using a stealthy browser approach.
    For Naukri, uses Firefox with anti-detection to bypass bot protection.
    Returns (success: bool, message: str).
    """
    password = decrypt(encrypted_password)

    if platform == "naukri":
        # Use direct Playwright with Firefox for Naukri (same approach as scraper)
        # This bypasses their anti-bot detection better than browser-use
        return await _test_naukri_login(username, password)
    else:
        # Use browser-use agent for LinkedIn
        return await _test_linkedin_login_with_agent(username, password)


async def _test_naukri_login(username: str, password: str) -> tuple[bool, str]:
    """Test Naukri login using stealthy Firefox browser."""
    from playwright.async_api import async_playwright
    import random
    from pathlib import Path
    from app.config import settings

    user_data_dir = Path(settings.UPLOAD_DIR) / ".naukri_test_ctx"
    user_data_dir.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as pw:
        # Launch Firefox with realistic settings
        width = random.randint(1280, 1920)
        height = random.randint(800, 1080)

        try:
            context = await pw.firefox.launch_persistent_context(
                user_data_dir=str(user_data_dir),
                headless=True,
                viewport={"width": width, "height": height},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) "
                    "Gecko/20100101 Firefox/120.0"
                ),
            )

            page = await context.new_page()

            # Navigate to Naukri homepage first (not directly to login)
            # This makes the request look more natural
            logger.info("Navigating to Naukri homepage...")
            await page.goto("https://www.naukri.com/", wait_until="networkidle", timeout=30000)
            await asyncio.sleep(random.uniform(2, 4))

            # Click on login button from homepage
            logger.info("Looking for login button...")
            login_btn = await page.query_selector('a[href*="nlogin"]')
            if login_btn:
                await login_btn.click()
                await asyncio.sleep(random.uniform(2, 3))

            # Check if we're on login page
            current_url = page.url
            if "nlogin" not in current_url and "login" not in current_url.lower():
                # Try navigating directly if button not found
                await page.goto("https://www.naukri.com/nlogin/login", wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(2)

            # Check for access denied / bot detection
            content = await page.content()
            if "Access Denied" in content or "permission" in content.lower():
                await context.close()
                return False, "Naukri is blocking automated access. Please login manually on naukri.com first, then try again."

            # Fill credentials
            logger.info("Filling credentials...")
            try:
                await page.fill('input[name="email"], input#usernameField, input[placeholder*="Email"]', username)
                await asyncio.sleep(random.uniform(0.5, 1.0))
                await page.fill('input[name="password"], input#passwordField, input[placeholder*="Password"]', password)
                await asyncio.sleep(random.uniform(0.5, 1.0))

                # Click submit
                submit_btn = await page.query_selector('button[type="submit"], .loginButton, button:has-text("Login")')
                if submit_btn:
                    await submit_btn.click()
                    await asyncio.sleep(random.uniform(3, 5))
            except Exception as fill_err:
                await context.close()
                return False, f"Could not fill login form: {str(fill_err)[:200]}"

            # Check result
            final_url = page.url
            content = await page.content()

            # Success indicators
            if "nlogin" not in final_url and "login" not in final_url.lower():
                if "feed" in final_url or "dashboard" in final_url or "home" in final_url or "jobs" in final_url:
                    await context.close()
                    return True, "Naukri login verified successfully ✓"

            # Check for error messages
            error_selectors = [".error", ".error-msg", ".login-error", '[class*="error"]']
            for selector in error_selectors:
                error_el = await page.query_selector(selector)
                if error_el:
                    error_text = await error_el.inner_text()
                    if error_text and len(error_text) < 200:
                        await context.close()
                        return False, f"Login failed: {error_text}"

            # If still on login page, check for any visible error
            if "nlogin" in final_url or "login" in final_url.lower():
                await context.close()
                return False, "Login failed — credentials may be incorrect, or Naukri blocked automated login. Try logging in manually on naukri.com first."

            await context.close()
            return True, "Naukri login verified ✓"

        except Exception as e:
            logger.error(f"Naukri login test failed: {e}", exc_info=True)
            return False, f"Login test error: {str(e)[:200]}"


async def _test_linkedin_login_with_agent(username: str, password: str) -> tuple[bool, str]:
    """Test LinkedIn login using browser-use agent."""
    task = f"""
Go to https://www.linkedin.com/login
Type email: {username}
Type password: {password}
Click the login/submit button.
Wait 5 seconds.
Look at the current URL and page content.

Reply with EXACTLY one of these two formats and nothing else:
LOGIN_SUCCESS
LOGIN_FAILED: [the exact error text shown on the page]
"""

    llm = _get_llm()
    browser = Browser(config=BrowserConfig(headless=True))
    agent = Agent(
        task=task,
        llm=llm,
        browser=browser,
        max_actions_per_step=4,
    )

    try:
        history = await agent.run(max_steps=10)
        result = (history.final_result() or "").strip()
        logger.info(f"Login test result for LinkedIn/{username}: {result[:100]}")

        if result.startswith("LOGIN_SUCCESS"):
            return True, "LinkedIn login verified successfully ✓"
        elif result.startswith("LOGIN_FAILED:"):
            reason = result.replace("LOGIN_FAILED:", "").strip()
            return False, reason or "Login failed — check your email and password"
        else:
            # Agent didn't follow format — try to infer
            if "success" in result.lower() or "logged in" in result.lower() or "feed" in result.lower():
                return True, "LinkedIn login verified ✓"
            return False, f"Login verification inconclusive: {result[:200]}"
    except Exception as e:
        logger.error(f"Login test exception: {e}", exc_info=True)
        return False, f"Could not verify login: {str(e)[:200]}"
    finally:
        try:
            await browser.close()
        except Exception:
            pass
