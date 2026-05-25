# apps/adk-orchestrator/config/gemini.py
# Backward-compat shim — all logic moved to config/llm.py
from .llm import async_generate, test_llm_connection, get_model  # noqa
