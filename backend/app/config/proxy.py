"""Two-tier proxy configuration.

Discovery tasks (scraping) use cheap datacenter proxies.
Apply tasks (login sessions, form filling) use residential proxies.
Free-tier users always get datacenter proxies.
"""

from __future__ import annotations

from app.config import settings


def get_proxy(task_type: str, user_tier: str = "free") -> str | None:
    """Return the proxy URL for a given task type and user tier.

    Args:
        task_type: One of 'naukri_scrape', 'linkedin_scrape', 'job_discovery',
                   'naukri_apply', 'linkedin_apply', 'generic_apply'
        user_tier: 'free' or 'pro'

    Returns:
        Proxy URL string, or None if no proxy is configured.
    """
    if not settings.PROXY_ENABLED:
        return None

    discovery_types = {"naukri_scrape", "linkedin_scrape", "job_discovery"}

    if task_type in discovery_types:
        return _get_datacenter_proxy()

    # Apply tasks — pro users get residential, free users get datacenter
    if user_tier == "pro" and settings.PROXY_RESIDENTIAL_URL:
        return _get_residential_proxy()

    return _get_datacenter_proxy()


def _get_datacenter_proxy() -> str | None:
    """Return a datacenter proxy URL (rotates through available proxies)."""
    urls = settings.PROXY_DATACENTER_URLS
    if not urls:
        return None
    # Round-robin: return the first URL for now (rotation handled by proxy provider)
    proxy_list = [u.strip() for u in urls.split(",") if u.strip()]
    if not proxy_list:
        return None
    return proxy_list[0]


def _get_residential_proxy() -> str | None:
    """Return a residential proxy URL with authentication."""
    url = settings.PROXY_RESIDENTIAL_URL
    if not url:
        return None
    # Inject user:pass into URL if provided separately
    user = settings.PROXY_RESIDENTIAL_USER
    passwd = settings.PROXY_RESIDENTIAL_PASS
    if user and passwd and "@" not in url:
        # URL format: http://host:port -> http://user:pass@host:port
        if url.startswith("http://"):
            url = f"http://{user}:{passwd}@{url[7:]}"
        elif url.startswith("https://"):
            url = f"https://{user}:{passwd}@{url[8:]}"
        elif url.startswith("socks5://"):
            url = f"socks5://{user}:{passwd}@{url[9:]}"
    return url