#!/bin/bash
set -e

echo "🚀 Starting JobBlitz AI..."

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ ERROR: Docker is not running. Start Docker Desktop or dockerd first."
  exit 1
fi
echo "  ✓ Docker daemon running"

# Check required env files
if [ ! -f backend/.env ]; then
  echo "❌ ERROR: backend/.env not found. Copy backend/.env.example to backend/.env and fill in values."
  exit 1
fi

if [ ! -f frontend/.env ]; then
  echo "⚠️ WARNING: frontend/.env not found. Creating with defaults..."
  echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" > frontend/.env
fi

# Ensure NEXT_PUBLIC_API_URL is set
if ! grep -q "NEXT_PUBLIC_API_URL" frontend/.env 2>/dev/null; then
  echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" >> frontend/.env
  echo "  ✓ Set NEXT_PUBLIC_API_URL in frontend/.env"
fi

# Build Neko image first (needed for cloud browser sessions)
# Uses m1k1o/neko:chromium from Docker Hub — no GHCR auth required
# --platform=linux/amd64 needed on Apple Silicon (no ARM64 variant available)
echo "🌐 Building Neko cloud browser image..."
docker build --platform=linux/amd64 -t jobblitz-neko:latest ./docker/neko/
echo "  ✓ Neko image ready: jobblitz-neko:latest"

# Pull latest images
docker compose pull redis postgres

# Build services
echo "🔨 Building services..."
docker compose build --parallel

# Start infra first
echo "🗄️ Starting database and Redis..."
docker compose up -d postgres redis

# Wait for DB to be ready
echo "⏳ Waiting for database..."
sleep 5

# Run migrations
echo "📦 Running database migrations..."
docker compose run --rm backend alembic upgrade head

# Start all services
echo "▶️ Starting all services..."
docker compose up -d

echo ""
echo "✅ JobBlitz AI is running!"
echo "   Frontend:  http://localhost:3001"
echo "   Backend:   http://localhost:8000"
echo "   API Docs:  http://localhost:8000/docs"
echo "   ARQ Queue: http://localhost:8000/health/detailed"
echo "   Health:    http://localhost:8000/health/"