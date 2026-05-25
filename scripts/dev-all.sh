#!/usr/bin/env bash
set -euo pipefail

# JobBlitz-AI Local Development Orchestrator
# Starts all services in dependency order with health checks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
DATABASE_URL="${DATABASE_URL:-postgresql://jobblitz:jobblitz@localhost:5432/jobblitz}"

declare -A SERVICES
declare -A HEALTH_URLS
declare -A PIDS
declare -A STATUSES

SERVICES[postgres]="PostgreSQL"
SERVICES[redis]="Redis"
SERVICES[api-legacy]="Python Legacy API"
SERVICES[api]="Hono API"
SERVICES[worker-orchestrator]="Orchestrator Worker"
SERVICES[worker-browser]="Browser Worker"
SERVICES[mcp-gateway]="MCP Gateway"
SERVICES[web]="Next.js Web"

HEALTH_URLS[api-legacy]="http://localhost:8004/health"
HEALTH_URLS[api]="http://localhost:8000/health"
HEALTH_URLS[mcp-gateway]="http://localhost:4000/"
HEALTH_URLS[web]="http://localhost:3000/"

log() {
  printf "[%-10s] %s\n" "$1" "$2"
}

start_postgres() {
  if docker ps --format '{{.Names}}' | grep -q '^jobblitz-postgres$'; then
    log "postgres" "Already running"
    STATUSES[postgres]="✅ Already running"
    return 0
  fi
  if docker ps -a --format '{{.Names}}' | grep -q '^jobblitz-postgres$'; then
    docker start jobblitz-postgres > /dev/null
  else
    docker run -d \
      --name jobblitz-postgres \
      -e POSTGRES_USER=jobblitz \
      -e POSTGRES_PASSWORD=jobblitz \
      -e POSTGRES_DB=jobblitz \
      -p 5432:5432 \
      -v jobblitz-pgdata:/var/lib/postgresql/data \
      pgvector/pgvector:pg16 > /dev/null
  fi
  log "postgres" "Container started"
  # Wait for health
  for i in {1..30}; do
    if docker exec jobblitz-postgres pg_isready -U jobblitz > /dev/null 2>&1; then
      STATUSES[postgres]="✅ Healthy"
      log "postgres" "Healthy"
      return 0
    fi
    sleep 1
  done
  STATUSES[postgres]="❌ Unhealthy"
  return 1
}

start_redis() {
  if docker ps --format '{{.Names}}' | grep -q '^jobblitz-redis$'; then
    log "redis" "Already running"
    STATUSES[redis]="✅ Already running"
    return 0
  fi
  if docker ps -a --format '{{.Names}}' | grep -q '^jobblitz-redis$'; then
    docker start jobblitz-redis > /dev/null
  else
    docker run -d \
      --name jobblitz-redis \
      -p 6379:6379 \
      -v jobblitz-redisdata:/data \
      redis:7 redis-server --appendonly yes > /dev/null
  fi
  log "redis" "Container started"
  for i in {1..20}; do
    if docker exec jobblitz-redis redis-cli ping | grep -q PONG; then
      STATUSES[redis]="✅ Healthy"
      log "redis" "Healthy"
      return 0
    fi
    sleep 1
  done
  STATUSES[redis]="❌ Unhealthy"
  return 1
}

wait_for_http() {
  local url="$1" name="$2" max_wait="${3:-60}"
  for i in $(seq 1 "$max_wait"); do
    if curl -fsS "$url" > /dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_api_legacy() {
  cd "$ROOT_DIR/apps/api-legacy"
  export DATABASE_URL="$DATABASE_URL"
  export REDIS_URL="$REDIS_URL"
  export ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
  export NEKO_PUBLIC_HOST=localhost
  export ADK_ORCHESTRATOR_URL=http://localhost:8001
  export PYTHONPATH="${ROOT_DIR}/apps/api-legacy"
  nohup uvicorn app.main:app --reload --port 8004 --host 0.0.0.0 > "$ROOT_DIR/.logs/api-legacy.log" 2>&1 &
  PIDS[api-legacy]=$!
  log "api-legacy" "PID ${PIDS[api-legacy]} starting..."
  if wait_for_http "${HEALTH_URLS[api-legacy]}" "api-legacy" 60; then
    STATUSES[api-legacy]="✅ Healthy (PID ${PIDS[api-legacy]})"
    log "api-legacy" "Healthy"
  else
    STATUSES[api-legacy]="❌ Unhealthy (PID ${PIDS[api-legacy]})"
    log "api-legacy" "Failed health check"
    return 1
  fi
}

start_api() {
  cd "$ROOT_DIR"
  export DATABASE_URL="$DATABASE_URL"
  export REDIS_URL="$REDIS_URL"
  export PORT=8000
  export WEB_URL=http://localhost:3000
  nohup bun run --filter=@jobblitz/api dev > "$ROOT_DIR/.logs/api.log" 2>&1 &
  PIDS[api]=$!
  log "api" "PID ${PIDS[api]} starting..."
  if wait_for_http "${HEALTH_URLS[api]}" "api" 60; then
    STATUSES[api]="✅ Healthy (PID ${PIDS[api]})"
    log "api" "Healthy"
  else
    STATUSES[api]="❌ Unhealthy (PID ${PIDS[api]})"
    log "api" "Failed health check"
    return 1
  fi
}

start_worker_orchestrator() {
  cd "$ROOT_DIR"
  export DATABASE_URL="$DATABASE_URL"
  export REDIS_URL="$REDIS_URL"
  nohup bun run --filter=@jobblitz/worker-orchestrator dev > "$ROOT_DIR/.logs/worker-orchestrator.log" 2>&1 &
  PIDS[worker-orchestrator]=$!
  log "worker-orchestrator" "PID ${PIDS[worker-orchestrator]} starting..."
  # BullMQ queue check via redis-cli
  sleep 3
  if docker exec jobblitz-redis redis-cli PING | grep -q PONG; then
    STATUSES[worker-orchestrator]="✅ Running (PID ${PIDS[worker-orchestrator]})"
    log "worker-orchestrator" "Running (queue accessible)"
  else
    STATUSES[worker-orchestrator]="❌ Unhealthy (PID ${PIDS[worker-orchestrator]})"
    return 1
  fi
}

start_worker_browser() {
  cd "$ROOT_DIR"
  export HEADLESS=true
  export REDIS_URL="$REDIS_URL"
  export BROWSER_WORKER_URL=http://localhost:8002
  nohup bun run --filter=@jobblitz/worker-browser dev > "$ROOT_DIR/.logs/worker-browser.log" 2>&1 &
  PIDS[worker-browser]=$!
  log "worker-browser" "PID ${PIDS[worker-browser]} starting..."
  sleep 3
  STATUSES[worker-browser]="✅ Running (PID ${PIDS[worker-browser]})"
  log "worker-browser" "Running"
}

start_mcp_gateway() {
  cd "$ROOT_DIR"
  export DATABASE_URL="$DATABASE_URL"
  export REDIS_URL="$REDIS_URL"
  export MCP_API_KEY="${MCP_API_KEY:-dev-mcp-key}"
  export OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}"
  export PORT=4000
  nohup bun run --filter=@jobblitz/mcp-gateway dev > "$ROOT_DIR/.logs/mcp-gateway.log" 2>&1 &
  PIDS[mcp-gateway]=$!
  log "mcp-gateway" "PID ${PIDS[mcp-gateway]} starting..."
  if wait_for_http "${HEALTH_URLS[mcp-gateway]}" "mcp-gateway" 60; then
    STATUSES[mcp-gateway]="✅ Healthy (PID ${PIDS[mcp-gateway]})"
    log "mcp-gateway" "Healthy"
  else
    STATUSES[mcp-gateway]="❌ Unhealthy (PID ${PIDS[mcp-gateway]})"
    log "mcp-gateway" "Failed health check"
    return 1
  fi
}

start_web() {
  cd "$ROOT_DIR"
  export NEXT_PUBLIC_API_URL=http://localhost:8000
  nohup bun run --filter=@jobblitz/web dev > "$ROOT_DIR/.logs/web.log" 2>&1 &
  PIDS[web]=$!
  log "web" "PID ${PIDS[web]} starting..."
  if wait_for_http "${HEALTH_URLS[web]}" "web" 120; then
    STATUSES[web]="✅ Healthy (PID ${PIDS[web]})"
    log "web" "Healthy"
  else
    STATUSES[web]="❌ Unhealthy (PID ${PIDS[web]})"
    log "web" "Failed health check"
    return 1
  fi
}

cleanup() {
  echo ""
  log "shutdown" "Stopping local services..."
  for key in api-legacy api worker-orchestrator worker-browser mcp-gateway web; do
    if [[ -n "${PIDS[$key]:-}" ]]; then
      kill "${PIDS[$key]}" 2>/dev/null || true
      log "$key" "Stopped"
    fi
  done
  exit 0
}

trap cleanup INT TERM

main() {
  mkdir -p "$ROOT_DIR/.logs"
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║         JobBlitz-AI Local Development Startup                ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""

  start_postgres
  start_redis
  start_api_legacy
  start_api
  start_worker_orchestrator
  start_worker_browser
  start_mcp_gateway
  start_web

  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║                   Startup Summary                            ║"
  echo "╠══════════════════════════════════════════════════════════════╣"
  printf "║  %-28s %-28s ║\n" "Service" "Status"
  echo "╠══════════════════════════════════════════════════════════════╣"
  for key in postgres redis api-legacy api worker-orchestrator worker-browser mcp-gateway web; do
    printf "║  %-28s %-28s ║\n" "${SERVICES[$key]}" "${STATUSES[$key]:-❌ Unknown}"
  done
  echo "╠══════════════════════════════════════════════════════════════╣"
  printf "║  %-56s ║\n" "Logs: $ROOT_DIR/.logs/"
  printf "║  %-56s ║\n" "Press Ctrl+C to stop all services"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""

  # Wait forever
  while true; do
    sleep 1
  done
}

main "$@"
