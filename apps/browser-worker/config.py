import os


def get_browse_bin() -> str:
    """Return the gstack browse binary path.

    In Docker: binary is baked at /opt/gstack/browse/dist/browse
    In local dev: binary lives at ~/.claude/skills/gstack/browse/dist/browse
    """
    env_path = os.getenv("BROWSE_BIN")
    if env_path and os.path.isfile(env_path) and os.access(env_path, os.X_OK):
        return env_path

    home_path = os.path.expanduser("~/.claude/skills/gstack/browse/dist/browse")
    if os.path.isfile(home_path) and os.access(home_path, os.X_OK):
        return home_path

    raise RuntimeError(
        "gstack browse binary not found. "
        "For Docker: binary should be at $BROWSE_BIN. "
        "For local dev: run bash apps/browser-worker/setup.sh first."
    )
