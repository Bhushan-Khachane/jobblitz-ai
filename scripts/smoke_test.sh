#!/bin/bash
set -e

BASE="http://localhost:8000"
ADK="http://localhost:8001"
BROWSER="http://localhost:8002"

echo "--- 1. Health checks ---"
curl -sf $BASE/health/browser-worker && echo " ✅ browser-worker (via backend)"
curl -sf $BASE/health/adk-orchestrator && echo " ✅ adk-orchestrator (via backend)"
curl -sf $BROWSER/health && echo " ✅ browser-worker service"
curl -sf $ADK/health && echo " ✅ adk-orchestrator service"

echo ""
echo "--- 2. Browser status ---"
curl -sf $BROWSER/browser/status || echo " ⚠️  browser status endpoint not ready"

echo ""
echo "--- 3. Test LLM connection (Ollama Pro or Gemini) ---"
RESULT=$(curl -sf $ADK/agent/test-gemini 2>/dev/null || echo '{"status":"unreachable"}')
echo $RESULT | python3 -c "
import sys, json
d = json.load(sys.stdin)
provider = d.get('provider', 'unknown')
model = d.get('model', 'unknown')
status = d.get('status', 'unknown')
if status == 'ok':
    print(f' ✅ LLM connected — provider={provider}, model={model}')
else:
    reason = d.get('reason', d.get('detail', 'unknown'))
    print(f' ⚠️  LLM unavailable — {reason}')
    print('     (Set OLLAMA_BASE_URL + OLLAMA_API_KEY in .env to use Ollama Pro)')
"

echo ""
echo "--- 4. Test goto command ---"
curl -sf -X POST $BROWSER/goto -H "Content-Type: application/json" \
  -d '{"url": "https://www.naukri.com", "session_id": "smoke-test"}' && echo " ✅ goto Naukri"

echo ""
echo "--- 5. Test snapshot ---"
curl -sf -X POST $BROWSER/snapshot \
  -H "Content-Type: application/json" -d '{"interactive": true, "session_id": "smoke-test"}' | head -c 500

echo ""
echo ""
echo "✅ Smoke test passed."
