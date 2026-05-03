#!/bin/bash
set -e

echo "🚀 Starting JobBlitz AI..."

# Check required env files
if [ ! -f backend/.env ]; then
  echo "❌ ERROR: backend/.env not found. Copy backend/.env.example to backend/.env and fill in values."
  exit 1
fi

if [ ! -f frontend/.env ]; then
  echo "⚠️ WARNING: frontend/.env not found. Creating with defaults..."
  echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" > frontend/.env
fi

# Pull latest images
docker-compose pull redis postgres

# Build services
echo "🔨 Building services..."
docker-compose build --parallel

# Start infra first
echo "🗄️ Starting database and Redis..."
docker-compose up -d postgres redis

# Wait for DB to be ready
echo "⏳ Waiting for database..."
sleep 5

# Run migrations
echo "📦 Running database migrations..."
docker-compose run --rm backend alembic upgrade head

# Start all services
echo "▶️ Starting all services..."
docker-compose up -d

echo ""
echo "✅ JobBlitz AI is running!"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:8000"
echo "   API Docs:  http://localhost:8000/docs"
echo "   Flower:    http://localhost:5555"
echo "   Health:    http://localhost:8000/health/detailed"
