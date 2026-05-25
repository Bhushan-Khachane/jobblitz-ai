"""LLM client with Ollama Pro primary, Gemini secondary, OpenAI fallback."""

from __future__ import annotations

import json
import logging

import aiohttp
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
    """Async LLM client with Ollama Pro primary, Gemini secondary, OpenAI fallback."""

    def __init__(self):
        self._session: aiohttp.ClientSession | None = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def generate(
        self,
        system: str,
        user: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        use_fallback: bool = False,
    ) -> str:
        """Generate a text completion. Uses Ollama Pro first, then Gemini, then OpenAI."""
        # If explicitly requesting fallback, skip Ollama
        providers = []
        if not use_fallback and settings.OLLAMA_BASE_URL and settings.OLLAMA_API_KEY:
            providers.append(self._generate_ollama)
        if settings.GEMINI_API_KEY:
            providers.append(self._generate_gemini)
        if settings.OPENAI_API_KEY:
            providers.append(self._generate_openai)

        if not providers:
            raise RuntimeError("No LLM provider configured. Set OLLAMA, GEMINI, or OPENAI keys.")

        last_error = None
        for provider in providers:
            try:
                return await provider(system, user, max_tokens, temperature)
            except Exception as e:
                last_error = e
                logger.warning(f"{provider.__name__} failed: {e}")
                continue

        raise RuntimeError(f"All LLM providers failed. Last error: {last_error}")

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

    async def _generate_ollama(
        self, system: str, user: str, max_tokens: int, temperature: float
    ) -> str:
        session = await self._get_session()
        prompt = f"{system}\n\n{user}" if system else user
        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/generate"
        headers = {"Authorization": f"Bearer {settings.OLLAMA_API_KEY}"}
        payload = {
            "model": settings.OLLAMA_PRO_MODEL,
            "prompt": prompt,
            "stream": False,
        }
        async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=120)) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data.get("response", "")

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
