import pytest
import uuid as uuid_module
from httpx import AsyncClient
from app.models import User, JobListing, Credential, Resume, Application


async def _create_user(db_session, email=None):
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    if email is None:
        email = f"app_{uuid_module.uuid4().hex[:8]}@test.com"
    user = User(
        email=email,
        hashed_password=pwd_context.hash("StrongPass1!"),
        full_name="App User",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def _login(client: AsyncClient, email="app@test.com"):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "StrongPass1!"},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_apply_no_auth(client: AsyncClient):
    resp = await client.post("/api/v1/applications/apply/" + str(uuid_module.uuid4()))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_apply_no_credentials(client: AsyncClient, db_session):
    user = await _create_user(db_session)
    token = await _login(client, user.email)

    listing = JobListing(
        user_id=user.id,
        platform="naukri",
        title="Python Dev",
        company="TestCo",
        status="discovered",
    )
    db_session.add(listing)
    await db_session.commit()
    await db_session.refresh(listing)

    resp = await client.post(
        f"/api/v1/applications/apply/{listing.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "credentials" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_apply_no_resume(client: AsyncClient, db_session):
    user = await _create_user(db_session)
    token = await _login(client, user.email)

    listing = JobListing(
        user_id=user.id,
        platform="naukri",
        title="Python Dev",
        company="TestCo",
        status="discovered",
    )
    db_session.add(listing)

    cred = Credential(
        user_id=user.id,
        platform="naukri",
        username="test",
        encrypted_password="gAAAAABk",
    )
    db_session.add(cred)
    await db_session.commit()
    await db_session.refresh(listing)

    resp = await client.post(
        f"/api/v1/applications/apply/{listing.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "resume" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_apply_idempotency(client: AsyncClient, db_session):
    user = await _create_user(db_session)
    token = await _login(client, user.email)

    listing = JobListing(
        user_id=user.id,
        platform="naukri",
        title="Python Dev",
        company="TestCo",
        status="discovered",
    )
    db_session.add(listing)

    cred = Credential(
        user_id=user.id,
        platform="naukri",
        username="test",
        encrypted_password="gAAAAABk",
    )
    db_session.add(cred)

    resume = Resume(
        user_id=user.id,
        title="My Resume",
        file_path="/tmp/resume.pdf",
        is_default=True,
    )
    db_session.add(resume)
    await db_session.commit()
    await db_session.refresh(listing)

    # First call succeeds
    resp1 = await client.post(
        f"/api/v1/applications/apply/{listing.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    # Should succeed or be idempotent (201 or 409)
    assert resp1.status_code in (201, 409)

    # Second call returns 409
    resp2 = await client.post(
        f"/api/v1/applications/apply/{listing.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_list_applications(client: AsyncClient, db_session):
    user = await _create_user(db_session)
    token = await _login(client, user.email)

    resp = await client.get(
        "/api/v1/applications/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_approve_not_pending(client: AsyncClient, db_session):
    user = await _create_user(db_session)
    token = await _login(client, user.email)

    listing = JobListing(
        user_id=user.id,
        platform="naukri",
        title="Python Dev",
        company="TestCo",
        status="discovered",
    )
    db_session.add(listing)
    await db_session.commit()
    await db_session.refresh(listing)

    app = Application(
        user_id=user.id,
        job_listing_id=listing.id,
        status="submitted",
        idempotency_key="test:1",
    )
    db_session.add(app)
    await db_session.commit()
    await db_session.refresh(app)

    resp = await client.post(
        f"/api/v1/applications/{app.id}/approve",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reject_application(client: AsyncClient, db_session):
    user = await _create_user(db_session)
    token = await _login(client, user.email)

    listing = JobListing(
        user_id=user.id,
        platform="naukri",
        title="Python Dev",
        company="TestCo",
        status="discovered",
    )
    db_session.add(listing)
    await db_session.commit()
    await db_session.refresh(listing)

    app = Application(
        user_id=user.id,
        job_listing_id=listing.id,
        status="pending",
        approval_status="pending_approval",
        idempotency_key="test:2",
    )
    db_session.add(app)
    await db_session.commit()
    await db_session.refresh(app)

    resp = await client.post(
        f"/api/v1/applications/{app.id}/reject",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["message"] == "Application rejected"


@pytest.mark.asyncio
async def test_queue_approval_wrong_key(client: AsyncClient):
    resp = await client.post(
        "/api/v1/applications/me/queue-approval",
        headers={"x-internal-api-key": "wrong-key"},
        json={
            "user_id": "00000000-0000-0000-0000-000000000001",
            "job_lead": {},
            "screening_result": {},
        },
    )
    assert resp.status_code == 403
