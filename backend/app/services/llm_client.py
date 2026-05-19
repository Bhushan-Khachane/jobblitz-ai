"""LLM client with Gemini primary and OpenAI fallback.

Primary: Google Gemini 1.5 Flash (cheaper, faster)
Fallback: OpenAI gpt-4o-mini (when Gemini is unavailable)
"""

from __future__ import annotations

import json
import logging

import google.generativeai as genai
from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

_gemini_model = None
_openai_client: AsyncOpenAI | None = None


def _get_gemini_model():
    global _gemini_model
    if _gemini_model is None:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _gemini_model = genai.GenerativeModel(settings.GEMINI_MODEL)
    return _gemini_model


def _get_openai_client() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


class LLMClient:
    """Async LLM client with Gemini primary and OpenAI fallback."""

    def __init__(self):
        self._gemini = None
        self._openai = None

    async def generate(
        self,
        system: str,
        user: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        use_fallback: bool = False,
    ) -> str:
        """Generate a text completion. Uses Gemini first, falls back to OpenAI on failure."""
        if use_fallback or not settings.GEMINI_API_KEY:
            return await self._generate_openai(system, user, max_tokens, temperature)

        try:
            return await self._generate_gemini(system, user, max_tokens, temperature)
        except Exception as e:
            logger.warning(f"Gemini generation failed: {e}. Falling back to OpenAI.")
            if settings.LLM_FALLBACK_ENABLED and settings.OPENAI_API_KEY:
                return await self._generate_openai(system, user, max_tokens, temperature)
            raise

    async def generate_structured(
        self,
        system: str,
        user: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> dict:
        """Generate a structured JSON response. Strips markdown fences if present."""
        raw = await self.generate(system, user, max_tokens, temperature)
        raw = raw.strip()
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse LLM structured response: {e}. Raw: {raw[:500]}")
            return {}

    async def _generate_gemini(
        self, system: str, user: str, max_tokens: int, temperature: float
    ) -> str:
        model = _get_gemini_model()
        prompt = f"{system}\n\n{user}" if system else user
        response = await model.generate_content_async(
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=temperature,
            ),
        )
        return response.text or ""

    async def _generate_openai(
        self, system: str, user: str, max_tokens: int, temperature: float
    ) -> str:
        client = _get_openai_client()
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""


_llm_client: LLMClient | None = None


def get_llm_client() -> LLMClient:
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client