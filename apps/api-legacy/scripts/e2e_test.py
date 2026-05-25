"""
End-to-end API test for JobBlitz.
Run: python backend/scripts/e2e_test.py
Requires: backend running at localhost:8000
"""
import httpx
import sys
import uuid

BASE = "http://localhost:8000/api/v1"
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASS  = "TestPass123!"

def run():
    c = httpx.Client(base_url=BASE, timeout=10)
    errors = []
    token = None

    def check(label, cond, msg=""):
        if not cond:
            errors.append(f"FAIL: {label} {msg}")
            print(f"  ✗ {label}")
        else:
            print(f"  ✓ {label}")

    print("\n=== JobBlitz E2E Test ===\n")

    # 1. Health
    print("1. Health check")
    r = c.get("http://localhost:8000/health/")
    check("Health 200", r.status_code == 200)

    # 2. Register
    print("\n2. Register")
    r = c.post("/auth/register", json={"email": TEST_EMAIL, "password": TEST_PASS, "full_name": "Test User"})
    check("Register 201", r.status_code == 201, r.text[:100])
    if r.status_code == 201:
        token = r.json()["access_token"]
        c.headers.update({"Authorization": f"Bearer {token}"})

    # 3. Get /me
    print("\n3. Auth /me")
    r = c.get("/auth/me")
    check("/me 200", r.status_code == 200)
    check("email matches", r.json().get("email") == TEST_EMAIL)
    check("plan field present", "plan" in r.json(), f"got keys: {list(r.json().keys())}")

    # 4. Update profile
    print("\n4. User profile update")
    r = c.put("/users/me", json={"full_name": "Test User Updated", "location": "Mumbai"})
    check("PUT /me 200", r.status_code == 200)

    # 5. Create job search
    print("\n5. Create job search")
    r = c.post("/job-searches/", json={
        "name": "Test Python Search",
        "keywords": "python developer",
        "location": "Mumbai",
        "platform": "naukri",
        "is_active": True,
    })
    check("Create search 201", r.status_code == 201, r.text[:100])
    search_id = r.json().get("id") if r.status_code == 201 else None

    # 6. List searches
    print("\n6. List searches")
    r = c.get("/job-searches/")
    check("List searches 200", r.status_code == 200)
    check("Search appears in list", any(s["id"] == search_id for s in r.json()) if search_id else False)

    # 7. Credentials list
    print("\n7. Credentials")
    r = c.get("/credentials/")
    check("List credentials 200", r.status_code == 200)

    # 8. Applications list
    print("\n8. Applications")
    r = c.get("/applications/")
    check("List applications 200", r.status_code == 200)

    # 9. Analytics
    print("\n9. Analytics")
    r = c.get("/analytics/overview")
    check("Analytics 200", r.status_code == 200)

    # Summary
    print(f"\n{'='*40}")
    if errors:
        print(f"FAILED ({len(errors)} errors):")
        for e in errors:
            print(f"  {e}")
        sys.exit(1)
    else:
        print("ALL TESTS PASSED ✅")
        print(f"Test user: {TEST_EMAIL}")

if __name__ == "__main__":
    run()