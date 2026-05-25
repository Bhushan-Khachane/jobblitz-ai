"""Verification Agent — Uses LLM to verify application success."""

import json
import os

import httpx
from config.llm import async_generate


BROWSER_WORKER_URL = os.getenv("BROWSER_WORKER_URL", "http://localhost:8002")


async def run_verification(application_run_id: str, session_id: str, expected_signals: list[str] | None = None) -> dict:
    """Verify that an application was submitted successfully.

    Input: application_run_id, expected_success_signals
    Output: verified: bool, evidence dict
    """
    evidence = {
        "run_id": application_run_id,
        "checks": [],
        "screenshot_path": None,
    }

    async with httpx.AsyncClient() as http:
        # 1. snapshot -D to check what changed
        try:
            diff_resp = await http.post(
                f"{BROWSER_WORKER_URL}/snapshot",
                json={"session_id": session_id, "interactive": False, "diff": True},
            )
            diff_text = diff_resp.text
            evidence["checks"].append({"name": "snapshot_diff", "result": "ok", "output": diff_text[:1000]})
        except Exception as e:
            evidence["checks"].append({"name": "snapshot_diff", "result": "error", "error": str(e)[:500]})
            diff_text = ""

        # 2. is_visible success toast / confirmation text
        verified_visible = False
        for signal in (expected_signals or ["success", "submitted", "thank you", "applied"]):
            try:
                vis_resp = await http.post(
                    f"{BROWSER_WORKER_URL}/is_visible",
                    json={"selector": f"text={signal}", "session_id": session_id},
                )
                if "true" in vis_resp.text.lower() or "visible" in vis_resp.text.lower():
                    verified_visible = True
                    evidence["checks"].append({"name": f"is_visible_{signal}", "result": "found"})
                    break
            except Exception:
                pass
        if not verified_visible:
            evidence["checks"].append({"name": "is_visible", "result": "not_found"})

        # 3. console_errors
        try:
            err_resp = await http.post(
                f"{BROWSER_WORKER_URL}/console_errors",
                json={"session_id": session_id},
            )
            console_errs = err_resp.text
            has_errors = bool(console_errs.strip() and console_errs.strip() != "[]")
            evidence["checks"].append({
                "name": "console_errors",
                "result": "errors_found" if has_errors else "clean",
                "output": console_errs[:500],
            })
        except Exception as e:
            evidence["checks"].append({"name": "console_errors", "result": "error", "error": str(e)[:500]})
            has_errors = True

        # 4. screenshot as proof artifact
        ss_path = f"/tmp/screenshots/{application_run_id}_verify.png"
        try:
            await http.post(
                f"{BROWSER_WORKER_URL}/screenshot",
                json={"path": ss_path, "session_id": session_id},
            )
            evidence["screenshot_path"] = ss_path
        except Exception:
            pass

    # Use LLM to judge overall verification
    system = "You are a verification agent. Check if a job application was successfully submitted based on page diff and content."
    prompt = f"""
Based on the evidence below, decide if the job application was successfully submitted.

Evidence checks:
{json.dumps(evidence['checks'], indent=2)}

Page diff:
{diff_text[:2000]}

Return ONLY a JSON object:
- verified (boolean)
- confidence (integer 0-100)
- reason (string)
"""

    raw = await async_generate(prompt, system=system, use_pro=False)

    try:
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        verdict = json.loads(raw)
    except Exception:
        verdict = {"verified": False, "confidence": 0, "reason": "Failed to parse verification response"}

    verified = verdict.get("verified", False) and not has_errors

    return {
        "agent": "verification",
        "run_id": application_run_id,
        "verified": verified,
        "confidence": verdict.get("confidence", 0),
        "reason": verdict.get("reason", ""),
        "evidence": evidence,
    }
