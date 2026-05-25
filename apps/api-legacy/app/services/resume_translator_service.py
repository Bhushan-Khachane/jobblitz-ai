"""
Resume Translator — replicates AIApply's Resume Translator feature.

Supports 50+ languages via deep-translator (Google Translate backend) with
LLM-powered professional tone correction after raw translation.
"""
from __future__ import annotations

import logging
from typing import Any

from app.services.llm_client import LLMClient

logger = logging.getLogger(__name__)


SUPPORTED_LANGUAGES: dict[str, str] = {
    "English": "en", "Hindi": "hi", "Spanish": "es", "French": "fr",
    "German": "de", "Portuguese": "pt", "Chinese (Simplified)": "zh-CN",
    "Chinese (Traditional)": "zh-TW", "Japanese": "ja", "Korean": "ko",
    "Arabic": "ar", "Russian": "ru", "Italian": "it", "Dutch": "nl",
    "Polish": "pl", "Turkish": "tr", "Vietnamese": "vi", "Thai": "th",
    "Indonesian": "id", "Malay": "ms", "Bengali": "bn", "Marathi": "mr",
    "Tamil": "ta", "Telugu": "te", "Kannada": "kn", "Gujarati": "gu",
    "Punjabi": "pa", "Ukrainian": "uk", "Czech": "cs", "Romanian": "ro",
    "Hungarian": "hu", "Swedish": "sv", "Norwegian": "no", "Danish": "da",
    "Finnish": "fi", "Greek": "el", "Hebrew": "iw", "Persian": "fa",
    "Swahili": "sw", "Afrikaans": "af", "Catalan": "ca", "Croatian": "hr",
    "Slovak": "sk", "Bulgarian": "bg", "Lithuanian": "lt", "Latvian": "lv",
    "Estonian": "et", "Slovenian": "sl", "Serbian": "sr", "Albanian": "sq",
}


class ResumeTranslatorService:
    def __init__(self) -> None:
        self._llm = LLMClient()

    def supported_languages(self) -> list[dict[str, str]]:
        return [{"name": name, "code": code} for name, code in SUPPORTED_LANGUAGES.items()]

    async def translate(
        self,
        resume_text: str,
        target_language: str,
        polish_tone: bool = True,
    ) -> dict[str, Any]:
        """
        Translate a resume into the target language and optionally polish tone.

        Returns: {translated_text, language, polished}
        """
        # Step 1: Raw machine translation via deep-translator
        try:
            from deep_translator import GoogleTranslator  # type: ignore
            lang_code = SUPPORTED_LANGUAGES.get(target_language, target_language)
            raw_translation = GoogleTranslator(
                source="auto", target=lang_code
            ).translate(resume_text[:4000])
        except Exception as exc:  # noqa: BLE001
            logger.warning("deep-translator failed: %s — falling back to LLM-only translation", exc)
            raw_translation = None

        # Step 2: LLM polish (tone correction + professional terminology)
        if polish_tone:
            source_text = raw_translation or resume_text
            prompt = (
                f"You are a professional resume writer.\n"
                f"Translate/rewrite the following resume into professional {target_language}.\n"
                "Preserve all facts, dates, titles, and company names exactly.\n"
                "Fix any awkward machine-translation phrasing to sound natural and professional.\n"
                "Do NOT add or remove any information.\n\n"
                f"{source_text[:3500]}\n\nReturn ONLY the translated resume text."
            )
            final_text = await self._llm.generate(prompt)
        else:
            final_text = raw_translation or resume_text

        return {
            "translated_text": final_text,
            "language": target_language,
            "polished": polish_tone,
        }


resume_translator_service = ResumeTranslatorService()
