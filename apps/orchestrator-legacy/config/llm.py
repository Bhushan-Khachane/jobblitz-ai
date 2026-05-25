import asyncio
import itertools
import os
from typing import Optional

import httpx
from google import genai as google_genai


# ── Ollama Pro config ──────────────────────────────────────
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "")
OLLAMA_API_KEY = os.getenv("OLLAMA_API_KEY", "")

# Model routing
# PRO   = heavy tasks: JD analysis, fit scoring, resume tailoring
# FAST  = light tasks: fill planning, verification, status sync
OLLAMA_PRO_MODEL = os.getenv("OLLAMA_PRO_MODEL", "kimi-k2")
OLLAMA_FAST_MODEL = os.getenv("OLLAMA_FAST_MODEL", "llama3.3:70b")

# ── Gemini fallback config ─────────────────────────────────
GEMINI_API_KEYS = [k for k in [
    os.getenv("GOOGLE_AI_STUDIO_API_KEY"),
    os.getenv("GOOGLE_AI_STUDIO_API_KEY_2"),
    os.getenv("GOOGLE_AI_STUDIO_API_KEY_3"),
] if k]

_gemini_cycle: itertools.cycle | None = None


def _init_gemini_cycle():
    global _gemini_cycle
    if GEMINI_API_KEYS:
        _gemini_cycle = itertools.cycle(GEMINI_API_KEYS)


def _next_gemini_key() -> Optional[str]:
    if not _gemini_cycle:
        _init_gemini_cycle()
    return next(_gemini_cycle) if _gemini_cycle else None


# ── Provider selection ─────────────────────────────────────
def _use_ollama() -> bool:
    return bool(OLLAMA_BASE_URL)


def get_model(use_pro: bool = False) -> str:
    if _use_ollama():
        return OLLAMA_PRO_MODEL if use_pro else OLLAMA_FAST_MODEL
    return (
        os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
        if use_pro
        else os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.0-flash")
    )


# ── Core async generate function ───────────────────────────
async def async_generate(
    prompt: str,
    tools=None,
    use_pro: bool = False,
    system: str = "",
) -> str:
    if _use_ollama():
        return await _ollama_generate(prompt, use_pro=use_pro, system=system)
    else:
        return await _gemini_generate(prompt, tools=tools, use_pro=use_pro)


# ── Ollama Pro (native Ollama API) ─────────────────────────
async def _ollama_generate(
    prompt: str,
    use_pro: bool = False,
    system: str = "",
) -> str:
    model = OLLAMA_PRO_MODEL if use_pro else OLLAMA_FAST_MODEL

    # Build prompt with system context
    full_prompt = prompt
    if system:
        full_prompt = f"{system}\n\n{prompt}"

    # Normalize base URL: strip trailing /api so we can add /api/generate
    base = OLLAMA_BASE_URL.rstrip("/")
    if base.endswith("/api"):
        base = base[:-4]

    headers = {"Content-Type": "application/json"}
    if OLLAMA_API_KEY:
        headers["Authorization"] = f"Bearer {OLLAMA_API_KEY}"

    payload = {
        "model": model,
        "prompt": full_prompt,
        "stream": False,
        "options": {"temperature": 0.3},
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{base}/api/generate",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["response"]


# ── Gemini fallback ────────────────────────────────────────
async def _gemini_generate(
    prompt: str,
    tools=None,
    use_pro: bool = False,
) -> str:
    api_key = _next_gemini_key()
    if not api_key:
        raise ValueError(
            "No LLM configured. Set OLLAMA_BASE_URL + OLLAMA_API_KEY "
            "or GOOGLE_AI_STUDIO_API_KEY in .env"
        )

    model = get_model(use_pro=use_pro)
    client = google_genai.Client(api_key=api_key)
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.models.generate_content(
            model=model,
            contents=prompt,
            config={"tools": tools or []},
        ),
    )
    return response.text


# ── Health check ───────────────────────────────────────────
async def test_llm_connection() -> dict:
    try:
        result = await async_generate("Reply with only: OK", use_pro=False)
        return {
            "provider": "ollama" if _use_ollama() else "gemini",
            "model": get_model(use_pro=False),
            "status": "ok",
            "response": result.strip()[:50],
        }
    except Exception as e:
        return {"status": "error", "reason": str(e)}
