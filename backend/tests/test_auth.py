import pytest
from httpx import AsyncClient
from app.models import User
from app.schemas import RegisterRequest


@pytest.mark.asyncio
async def test_register_happy_path(client: AsyncClient, db_session):
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "test1@example.com",
            "password": "StrongPass1!",
            "full_name": "Test User",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, db_session):
    resp1 = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "dup@example.com",
            "password": "StrongPass1!",
            "full_name": "First User",
        },
    )
    assert resp1.status_code == 201

    resp2 = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "dup@example.com",
            "password": "StrongPass1!",
            "full_name": "Second User",
        },
    )
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "weak@example.com",
            "password": "weak1",
            "full_name": "Weak User",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_correct(client: AsyncClient, db_session):
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "login@example.com",
            "password": "StrongPass1!",
            "full_name": "Login User",
        },
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "StrongPass1!"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, db_session):
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "wrong@example.com",
            "password": "StrongPass1!",
            "full_name": "Wrong User",
        },
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "wrong@example.com", "password": "WrongPass1!"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_valid_token(client: AsyncClient, db_session):
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "refresh@example.com",
            "password": "StrongPass1!",
            "full_name": "Refresh User",
        },
    )
    refresh_token = reg.json()["refresh_token"]

    resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_refresh_invalid_token(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid.token.here"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_replay_blocked(client: AsyncClient, db_session):
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "replay@example.com",
            "password": "StrongPass1!",
            "full_name": "Replay User",
        },
    )
    refresh_token = reg.json()["refresh_token"]

    # First refresh succeeds
    resp1 = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp1.status_code == 200

    # Second refresh with same token must fail
    resp2 = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp2.status_code == 401
