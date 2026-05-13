FROM node:20-slim

# Install system deps for Chromium + Python
RUN apt-get update && apt-get install -y \
    git curl unzip \
    chromium chromium-sandbox \
    fonts-liberation libappindicator3-1 libasound2 \
    libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
    libgdk-pixbuf2.0-0 libnspr4 libnss3 libx11-xcb1 \
    libxcomposite1 libxdamage1 libxrandr2 xdg-utils \
    libxss1 libxtst6 ca-certificates \
    python3 python3-pip \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Clone and build gstack
RUN git clone https://github.com/garrytan/gstack.git /opt/gstack
WORKDIR /opt/gstack
RUN ./setup

# Set browse binary path
ENV BROWSE_BIN=/opt/gstack/browse/dist/browse

# Copy browser-worker code
WORKDIR /app
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt
COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
