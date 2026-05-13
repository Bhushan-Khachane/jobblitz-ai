import subprocess
from config import get_browse_bin

B = get_browse_bin()


def _run(*args) -> str:
    result = subprocess.run([B, *args], capture_output=True, text=True, timeout=30)
    return result.stdout.strip() or result.stderr.strip()


def goto(url: str) -> str:
    return _run("goto", url)


def snapshot(interactive: bool = True, diff: bool = False) -> str:
    flags = []
    if interactive:
        flags.append("-i")
    if diff:
        flags.append("-D")
    return _run("snapshot", *flags)


def text() -> str:
    return _run("text")


def links() -> str:
    return _run("links")


def fill(ref: str, value: str) -> str:
    return _run("fill", ref, value)


def click(ref: str) -> str:
    return _run("click", ref)


def upload(ref: str, file_path: str) -> str:
    return _run("upload", ref, file_path)


def screenshot(path: str) -> str:
    return _run("screenshot", path)


def is_visible(selector: str) -> str:
    return _run("is", "visible", selector)


def console_errors() -> str:
    return _run("console", "--errors")


def status() -> str:
    return _run("status")


def import_cookies(portal: str, domain: str) -> str:
    return _run("cookie-import-browser", portal, "--domain", domain)


def url() -> str:
    return _run("url")


def handoff(message: str = "") -> str:
    args = ["handoff"]
    if message:
        args.extend(["--message", message])
    return _run(*args)


def resume() -> str:
    return _run("resume")


def state_save(name: str) -> str:
    return _run("state", "save", name)


def state_load(name: str) -> str:
    return _run("state", "load", name)


def cookie_import_file(cookie_file: str) -> str:
    return _run("cookie-import", cookie_file)
