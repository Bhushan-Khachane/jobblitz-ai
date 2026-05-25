"""
JobBlitz smoke test — validates all backend endpoints and worker health.

Run from repo root:
    python -m scripts.smoke_test

Requires the backend and ARQ worker to be running.
"""

import os
import sys
import time
import requests

BASE = os.getenv("API_BASE", "http://localhost:8000")
TIMEOUT = 10


def check(name: str, url: str, expected_status: int = 200, method: str = "GET") -> bool:
    try:
        r = requests.request(method, url, timeout=TIMEOUT)
        ok = r.status_code == expected_status
        tag = "OK" if ok else "FAIL"
        print(f"  [{tag}] {name}: {r.status_code} (expected {expected_status})")
        if not ok:
            print(f"        body: {r.text[:200]}")
        return ok
    except Exception as e:
        print(f"  [FAIL] {name}: {e}")
        return False


def main():
    passed = 0
    failed = 0

    print("=" * 60)
    print("JobBlitz Smoke Test")
    print(f"API: {BASE}")
    print("=" * 60)

    # --- Unauthenticated health checks ---
    print("\n1. Health endpoints (no auth)")
    if check("GET /health/", f"{BASE}/health/"):
        passed += 1
    else:
        failed += 1

    if check("GET /health/ready", f"{BASE}/health/ready"):
        passed += 1
    else:
        failed += 1

    # --- Auth flow ---
    print("\n2. Auth endpoints")
    if check("POST /auth/register (expect 422 — no body)", f"{BASE}/auth/register", expected_status=422, method="POST"):
        passed += 1
    else:
        failed += 1

    if check("POST /auth/login (expect 422 — no body)", f"{BASE}/auth/login", expected_status=422, method="POST"):
        passed += 1
    else:
        failed += 1

    # --- Protected endpoints (expect 401/403 without auth) ---
    print("\n3. Protected endpoints (expect 401/403)")
    protected = [
        ("GET /users/me", f"{BASE}/users/me"),
        ("GET /users/me/profile", f"{BASE}/users/me/profile"),
        ("GET /resumes/", f"{BASE}/resumes/"),
        ("GET /credentials/", f"{BASE}/credentials/"),
        ("GET /applications/", f"{BASE}/applications/"),
        ("GET /searches/", f"{BASE}/searches/"),
        ("GET /analytics/overview", f"{BASE}/analytics/overview"),
    ]
    for name, url in protected:
        r = requests.get(url, timeout=TIMEOUT)
        ok = r.status_code in (401, 403)
        tag = "OK" if ok else "FAIL"
        print(f"  [{tag}] {name}: {r.status_code} (expected 401/403)")
        if ok:
            passed += 1
        else:
            failed += 1

    # --- OpenAPI docs ---
    print("\n4. API docs")
    if check("GET /docs (Swagger UI)", f"{BASE}/docs"):
        passed += 1
    else:
        failed += 1

    if check("GET /openapi.json", f"{BASE}/openapi.json"):
        passed += 1
    else:
        failed += 1

    # --- Summary ---
    print("\n" + "=" * 60)
    total = passed + failed
    print(f"Results: {passed}/{total} passed, {failed} failed")
    if failed > 0:
        print("STATUS: FAILED")
        sys.exit(1)
    else:
        print("STATUS: PASSED")
        sys.exit(0)


if __name__ == "__main__":
    main()