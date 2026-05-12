# ARM64-native Chromium cloud browser for login sessions.
# Uses linuxserver/chromium base which runs natively on Apple Silicon.
# JobBlitz never handles user passwords — only session cookies are captured.

FROM lscr.io/linuxserver/chromium:latest

USER root

# Install socat to proxy localhost-only CDP to all interfaces
RUN apt-get update \
    && apt-get install -y --no-install-recommends socat \
    && rm -rf /var/lib/apt/lists/*

# Enable Chromium remote debugging on localhost:9222
RUN printf 'export CHROMIUM_FLAGS="$CHROMIUM_FLAGS --remote-debugging-port=9222"\n' \
    > /etc/chromium.d/remote-debugging

# Remove --test-type (bot-detection signal) and add anti-evasion flags
# --test-type is added by wrapped-chromium for unprivileged containers;
# we patch the wrapper to drop it and add normal-browser signals instead.
RUN sed -i 's/--test-type //g' /usr/bin/wrapped-chromium \
    && sed -i 's/--disable-dev-shm-usage //g' /usr/bin/wrapped-chromium 2>/dev/null || true

# Additional Chromium flags to look like a normal desktop browser
RUN printf 'export CHROMIUM_FLAGS="$CHROMIUM_FLAGS --disable-blink-features=AutomationControlled --disable-features=IsolateOrigins,site-per-process --window-size=1920,1080 --force-device-scale-factor=1"\n' \
    > /etc/chromium.d/anti-bot

# Proxy CDP from 127.0.0.1:9222 to 0.0.0.0:9223 so backend can reach it
RUN mkdir -p /custom-cont-init.d \
    && printf '#!/bin/bash\n(sleep 8 \&\& while true; do\n  socat TCP-LISTEN:9223,fork,reuseaddr TCP:127.0.0.1:9222\ndone) \&\n' \
    > /custom-cont-init.d/50-cdp-proxy \
    && chmod +x /custom-cont-init.d/50-cdp-proxy

EXPOSE 3000
EXPOSE 9223
