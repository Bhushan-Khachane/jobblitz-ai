import pytest
from pydantic import ValidationError
from app.schemas import (
    RegisterRequest,
    ApplicationStatusUpdate,
    JobSearchCreate,
)


def test_register_request_weak_password():
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="a@b.com",
            password="weak",
            full_name="Test",
        )


def test_register_request_missing_uppercase():
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="a@b.com",
            password="lowercase1!",
            full_name="Test",
        )


def test_register_request_missing_digit():
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="a@b.com",
            password="NoDigits!",
            full_name="Test",
        )


def test_register_request_missing_special():
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="a@b.com",
            password="NoSpecial1",
            full_name="Test",
        )


def test_register_request_strong_password():
    r = RegisterRequest(
        email="a@b.com",
        password="Str0ng1!",
        full_name="Test",
    )
    assert r.password == "Str0ng1!"


def test_register_request_invalid_email():
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="not-an-email",
            password="Str0ng1!",
            full_name="Test",
        )


def test_application_status_update_invalid():
    with pytest.raises(ValidationError):
        ApplicationStatusUpdate(status="invalid_status")


def test_application_status_update_valid():
    u = ApplicationStatusUpdate(status="submitted")
    assert u.status == "submitted"


def test_job_search_create_invalid_platform():
    with pytest.raises(ValidationError):
        JobSearchCreate(
            name="Test",
            platform="invalid",
            keywords="python",
        )


def test_job_search_create_valid():
    js = JobSearchCreate(
        name="Test",
        platform="naukri",
        keywords="python",
    )
    assert js.platform == "naukri"
