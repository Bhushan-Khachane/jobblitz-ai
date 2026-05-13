"""Naukri Job Detail Extractor — Navigate to job page and extract JD."""

import asyncio
import os
from typing import Any

import httpx

BROWSER_WORKER_URL = os.getenv("BROWSER_WORKER_URL", "http://localhost:8002")


def extract_ref(line: str) -> str:
    import re
    m = re.search(r'(@e\d+)', line)
    return m.group(1) if m else ""


def extract_text(line: str) -> str:
    import re
    m = re.search(r'"([^"]+)"', line)
    return m.group(1) if m else ""


async def extract_job_details(job_url: str, session_id: str = "default") -> dict:
    """
    Navigate to a Naukri job detail page and extract full JD.
    Returns: title, company, location, experience, salary,
             jd_text, skills, posted_at, apply_ref
    """
    async with httpx.AsyncClient() as http:
        # Navigate to job detail page
        await http.post(
            f"{BROWSER_WORKER_URL}/goto",
            json={"url": job_url, "session_id": session_id},
        )

        # Wait for page load
        await asyncio.sleep(2)

        # Get page text
        text_resp = await http.post(
            f"{BROWSER_WORKER_URL}/text",
            json={"session_id": session_id},
        )
        page_text = text_resp.text

        # Get interactive snapshot to find apply button
        snap_resp = await http.post(
            f"{BROWSER_WORKER_URL}/snapshot",
            json={"session_id": session_id, "interactive": True},
        )
        snap = snap_resp.text

    # Find apply button ref
    apply_ref = ""
    for line in snap.split("\n"):
        if "[button]" in line and "apply" in line.lower():
            apply_ref = extract_ref(line)
            break

    # Extract title from first heading or link
    title = ""
    for line in snap.split("\n"):
        if "[heading]" in line or ("[link]" in line and "job" in line.lower()):
            title = extract_text(line)
            if title:
                break

    # Extract skills if present
    skills = []
    skill_keywords = ["python", "javascript", "react", "node", "django", "flask",
                      "sql", "aws", "docker", "kubernetes", "git", "linux",
                      "machine learning", "data science", "ai", "ml"]
    for kw in skill_keywords:
        if kw.lower() in page_text.lower():
            skills.append(kw)

    return {
        "url": job_url,
        "title": title,
        "raw_text": page_text,
        "apply_ref": apply_ref,
        "snapshot": snap,
        "skills": skills,
    }
