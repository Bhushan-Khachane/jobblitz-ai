# Ollama Pro Model Routing for JobBlitzz

## Which model does what

| Agent              | use_pro | Recommended Model     | Why                              |
|--------------------|---------|-----------------------|----------------------------------|
| DiscoveryAgent     | False   | llama3.3:70b          | Fast DOM parsing, low complexity |
| ScreeningAgent     | True    | kimi-k2               | Deep JD reasoning, resume gap    |
| PlannerAgent       | False   | llama3.3:70b          | Structured JSON form planning    |
| ApplyAgent         | False   | llama3.3:70b          | Step-by-step browser decisions   |
| VerificationAgent  | False   | llama3.3:70b          | Page diff interpretation         |
| StatusSyncAgent    | False   | llama3.3:70b          | Inbox text classification        |

## Kimi K2 for screening
Kimi K2 has native tool-calling and long-context reasoning —
ideal for reading a full JD + full resume + scoring gap analysis in one shot.

## Cost
Ollama Pro subscription covers all model usage.
No per-token cost within your plan limits.

## Fallback chain
1. OLLAMA_BASE_URL set → use Ollama Pro
2. OLLAMA_BASE_URL empty → use Gemini (rotate keys)
3. All Gemini keys exhausted → raise LLMUnavailableError
