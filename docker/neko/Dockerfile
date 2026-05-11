FROM ghcr.io/m1k1o/neko:chromium

# Neko cloud browser for login sessions
# Users log in through this streamed browser — JobBlitz never handles passwords.
# Container auto-destructs after 10 minutes via cleanup_sessions_task.

ENV NEKO_SCREEN=1366x768@30
ENV NEKO_EPR=52000-52100

EXPOSE 8080
EXPOSE 52000-52100/udp

# No password persistence — all sessions are ephemeral
# Password is set via NEKO_PASSWORD env var at container creation time