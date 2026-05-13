"""Screening Agent — Uses LLM for deep JD analysis and fit scoring."""

import json

from config.llm import async_generate


async def run_screening(job_lead: dict, user_profile: dict, resume_text: str) -> dict:
    """Run screening for a job lead.

    Input: job_lead, user_profile, resume_text
    Output: fit_score, must_have_match, gap_notes, decision
    """
    jd_text = job_lead.get("jd_text", "")
    title = job_lead.get("title", "")
    company = job_lead.get("company", "")

    system = (
        "You are a job fit scoring agent. "
        "Score jobs 0-100 based on how well the candidate's profile matches the job description. "
        "Return JSON with fit_score, must_have_match (bool), gap_notes, decision (auto/approve/skip)."
    )
    prompt = f"""
Compare the candidate's profile against the job description and return a structured analysis.

Job Title: {title}
Company: {company}
Job Description:
{jd_text[:6000]}

Candidate Profile:
{json.dumps(user_profile, indent=2)}

Resume Text:
{resume_text[:4000]}

Return ONLY a JSON object with these exact keys:
- fit_score (integer 0-100)
- must_have_match (object: keys are requirements, values are "matched" or "missing")
- gap_notes (string: summarize key gaps)
- decision (string: one of "auto", "approve", "skip")

Rules for decision:
- "auto" if fit_score >= 85 and no major gaps
- "approve" if fit_score >= 60 and < 85
- "skip" if fit_score < 60
"""

    raw = await async_generate(prompt, system=system, use_pro=True)

    try:
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        result = json.loads(raw)
    except Exception:
        result = {
            "fit_score": 0,
            "must_have_match": {},
            "gap_notes": "Failed to parse screening response",
            "decision": "skip",
        }

    return {
        "agent": "screening",
        "job_lead_id": job_lead.get("id"),
        "fit_score": result.get("fit_score", 0),
        "must_have_match": result.get("must_have_match", {}),
        "gap_notes": result.get("gap_notes", ""),
        "decision": result.get("decision", "skip"),
    }
