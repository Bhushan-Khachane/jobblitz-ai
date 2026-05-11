#!/bin/bash
set -euo pipefail

VERSION=$(git rev-parse --short HEAD)
echo "=== Deploying JobBlitz v${VERSION} to Hetzner ==="

# Build images
echo "[1/6] Building images..."
docker build -t jobblitz/api:${VERSION} ./backend
docker build -t jobblitz/api:latest ./backend
docker build -t jobblitz/frontend:${VERSION} ./frontend
docker build -t jobblitz/frontend:latest ./frontend

# Push to registry (or load on remote hosts)
echo "[2/6] Pushing images..."
# For Hetzner, you'd push to a registry or use docker save/load
# docker push jobblitz/api:${VERSION}
# docker push jobblitz/frontend:${VERSION}

# Run database migrations
echo "[3/6] Running Alembic migrations..."
docker compose -f docker-compose.yml run --rm backend alembic upgrade head

# Deploy backend
echo "[4/6] Deploying backend..."
docker compose -f docker-compose.prod.yml up -d backend

# Wait for health check
echo "[5/6] Waiting for health check..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo "  Backend is healthy!"
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 2
done

# Deploy workers and frontend
echo "[6/6] Deploying workers and frontend..."
docker compose -f docker-compose.prod.yml up -d arq_worker neko_host frontend traefik

echo "=== Deployment complete: ${VERSION} ==="
echo "Backend:  https://api.jobblitz.ai"
echo "Frontend: https://jobblitz.ai"
echo ""
echo "To rollback: docker compose -f docker-compose.prod.yml down"