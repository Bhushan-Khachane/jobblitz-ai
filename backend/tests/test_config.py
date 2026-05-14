from app.config import settings


def test_internal_api_key_exists():
    assert hasattr(settings, "INTERNAL_API_KEY")
    assert settings.INTERNAL_API_KEY is not None


def test_secret_key_length():
    assert len(settings.SECRET_KEY) >= 32


def test_fernet_key_exists():
    assert hasattr(settings, "FERNET_KEY")
    assert settings.FERNET_KEY is not None
    assert len(settings.FERNET_KEY) > 0


def test_required_settings_load():
    assert settings.DATABASE_URL
    assert settings.REDIS_URL
    assert settings.ALGORITHM == "HS256"
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES > 0
    assert settings.REFRESH_TOKEN_EXPIRE_DAYS > 0
