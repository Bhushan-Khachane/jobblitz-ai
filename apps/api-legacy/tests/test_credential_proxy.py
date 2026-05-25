import asyncio

import pytest

from app.services.credential_proxy import CredentialProxy


@pytest.mark.asyncio
async def test_token_expires_after_120s():
    proxy = CredentialProxy(ttl_seconds=1)
    token = await proxy.put(
        user_id="user-1",
        platform="linkedin",
        creds={"username": "alice", "password": "secret123"},
    )
    # Immediately available
    assert proxy.get(token) is not None
    # Wait for TTL
    await asyncio.sleep(1.5)
    assert proxy.get(token) is None


@pytest.mark.asyncio
async def test_token_is_single_use():
    proxy = CredentialProxy(ttl_seconds=120)
    token = await proxy.put(
        user_id="user-2",
        platform="naukri",
        creds={"username": "bob", "password": "password456"},
    )
    first = proxy.get(token)
    assert first is not None
    assert first["password"] == "password456"
    # Second get must return None
    assert proxy.get(token) is None


@pytest.mark.asyncio
async def test_plaintext_password_not_in_prompt_string():
    """Credentials must never appear in any string passed to an LLM or event payload."""
    proxy = CredentialProxy(ttl_seconds=120)
    secret = "my_super_secret_password_789"
    token = await proxy.put(
        user_id="user-3",
        platform="greenhouse",
        creds={"username": "charlie", "password": secret},
    )

    # Simulate building a prompt / event payload that only references the token
    prompt = f"Use session token {token} to authenticate"
    event_payload = {"event": "step", "step": "auth_resolve", "token": token}

    assert secret not in prompt
    assert secret not in str(event_payload)
    assert token in prompt
    assert token in str(event_payload)

    # Verify retrieval still works
    creds = proxy.get(token)
    assert creds is not None
    assert creds["password"] == secret


@pytest.mark.asyncio
async def test_multiple_tokens_isolated():
    proxy = CredentialProxy(ttl_seconds=120)
    t1 = await proxy.put(user_id="u1", platform="p1", creds={"password": "pass1"})
    t2 = await proxy.put(user_id="u2", platform="p2", creds={"password": "pass2"})

    assert proxy.get(t1)["password"] == "pass1"
    assert proxy.get(t2)["password"] == "pass2"
    assert proxy.get(t1) is None  # single-use
    assert proxy.get(t2) is None  # single-use
