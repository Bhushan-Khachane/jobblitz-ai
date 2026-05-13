"""Fit scorer and JD extractor for the screening agent."""

import json
import os
import re
from typing import Any

import httpx

GEMINI_API_KEY = os.getenv("GOOGLE_AI_STUDIO_API_KEY") or os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")


def extract_jd_sections(jd_text: str) -> dict[str, Any]:
    """Extract structured sections from a raw job description."""
    sections = {
        "title": "",
        "company": "",
        "location": "",
        "summary": "",
        "responsibilities": [],
        "requirements": [],
        "preferred": [],
        "salary": "",
        "experience_years": None,
    }

    lines = jd_text.splitlines()
    current_section = "summary"

    for line in lines:
        line = line.strip()
        if not line:
            continue
        lower = line.lower()
        if any(k in lower for k in ["responsibilit", "what you'll do", "role", "duties"]):
            current_section = "responsibilities"
            continue
        if any(k in lower for k in ["requirement", "must have", "qualification", "skills needed"]):
            current_section = "requirements"
            continue
        if any(k in lower for k in ["preferred", "nice to have", "bonus", "plus"]):
            current_section = "preferred"
            continue
        if any(k in lower for k in ["salary", "compensation", "ctc", "package"]):
            current_section = "salary"
            continue

        if current_section == "responsibilities":
            sections["responsibilities"].append(line)
        elif current_section == "requirements":
            sections["requirements"].append(line)
        elif current_section == "preferred":
            sections["preferred"].append(line)
        elif current_section == "salary":
            sections["salary"] += " " + line
        else:
            sections["summary"] += " " + line

    # Try to extract experience years
    match = re.search(r'(\d+)\+?\s*years?', jd_text, re.IGNORECASE)
    if match:
        sections["experience_years"] = int(match.group(1))

    return sections


async def score_fit(
    jd_text: str,
    resume_text: str,
    user_profile: dict[str, Any],
) -> dict[str, Any]:
    """Use Gemini to compute a fit score between a JD and candidate profile."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    headers = {"Content-Type": "application/json"}
    params = {"key": GEMINI_API_KEY}

    prompt = f"""
You are an expert resume screener. Compare the candidate profile to the job description.

Job Description:
{jd_text[:6000]}

Candidate Resume:
{resume_text[:4000]}

Candidate Profile:
{json.dumps(user_profile, indent=2)}

Return ONLY a JSON object with these exact keys:
- fit_score (integer 0-100)
- must_have_match (object: requirement -> "matched" or "missing")
- gap_notes (string)
- decision (one of: "auto", "approve", "skip")

Rules:
- "auto" if fit_score >= 85
- "approve" if fit_score >= 60 and < 85
- "skip" if fit_score < 60
"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, params=params, json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        result = json.loads(raw_text)

    return {
        "fit_score": result.get("fit_score", 0),
        "must_have_match": result.get("must_have_match", {}),
        "gap_notes": result.get("gap_notes", ""),
        "decision": result.get("decision", "skip"),
    }
