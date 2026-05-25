"""Email service using Resend."""

from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


async def send_email(to: str, subject: str, html: str, text: str | None = None) -> dict:
    """Send an email via Resend HTTP API."""
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured — email not sent")
        return {"sent": False, "error": "RESEND_API_KEY not configured"}

    payload = {
        "from": settings.RESEND_FROM_EMAIL,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                RESEND_API_URL,
                json=payload,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info(f"Email sent to {to}: id={data.get('id')}")
            return {"sent": True, "id": data.get("id")}
    except httpx.HTTPStatusError as e:
        logger.error(f"Resend API error: {e.response.status_code} {e.response.text}")
        return {"sent": False, "error": f"Resend API error: {e.response.status_code}"}
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return {"sent": False, "error": str(e)}


# ── Templates ─────────────────────────────────────────────────────────────────


def _base_template(title: str, body_html: str) -> str:
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; margin: 0; padding: 0; }}
        .container {{ max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }}
        .header {{ background: #0d9488; padding: 32px 24px; text-align: center; }}
        .header h1 {{ color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; }}
        .content {{ padding: 32px 24px; color: #27272a; line-height: 1.6; }}
        .footer {{ padding: 24px; text-align: center; color: #a1a1aa; font-size: 12px; border-top: 1px solid #e4e4e7; }}
        .button {{ display: inline-block; padding: 12px 24px; background: #0d9488; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; }}
        .muted {{ color: #71717a; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{title}</h1>
        </div>
        <div class="content">
            {body_html}
        </div>
        <div class="footer">
            <p>JobBlitz-AI — Autonomous job applications</p>
            <p>You received this because you enabled email notifications in your account settings.</p>
        </div>
    </div>
</body>
</html>
"""


def follow_up_email_template(full_name: str, company: str, job_title: str, applied_date: str) -> str:
    body = f"""
        <p>Hi {full_name},</p>
        <p>You applied for <strong>{job_title}</strong> at <strong>{company}</strong> on {applied_date}.</p>
        <p>We haven't detected any status update yet. Would you like us to send a polite follow-up email to the recruiter on your behalf?</p>
        <p style="margin-top: 24px;">
            <a href="#" class="button">Review in Dashboard</a>
        </p>
        <p class="muted">If you've already heard back, you can dismiss this from your dashboard.</p>
    """
    return _base_template("Follow-up Reminder", body)


def daily_digest_template(
    full_name: str,
    new_jobs: int,
    applications_today: int,
    pending_approvals: int,
    avg_match_score: int,
) -> str:
    body = f"""
        <p>Good morning, {full_name}!</p>
        <p>Here&apos;s what happened with your JobBlitz account in the last 24 hours:</p>
        <ul>
            <li><strong>{new_jobs}</strong> new jobs discovered</li>
            <li><strong>{applications_today}</strong> applications submitted today</li>
            <li><strong>{pending_approvals}</strong> pending approvals awaiting your decision</li>
            <li><strong>{avg_match_score}%</strong> average match score</li>
        </ul>
        <p style="margin-top: 24px;">
            <a href="#" class="button">Open Dashboard</a>
        </p>
        <p class="muted">You can change your digest frequency in notification settings.</p>
    """
    return _base_template("Your Daily Digest", body)
