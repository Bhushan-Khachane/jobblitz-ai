#!/usr/bin/env bash
set -euo pipefail

# JobBlitz-AI Fly.io Deployment Script
# Deploys all services in dependency order

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

ENV_FILE="${ROOT_DIR}/.env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env.production not found at $ENV_FILE"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         JobBlitz-AI Production Deployment                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Helper: set secrets from .env.production for an app
set_fly_secrets() {
  local app="$1"
  echo "[deploy] Setting secrets for $app..."
  while IFS='=' read -r key value || [[ -n "$key" ]]; do
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    fly secrets set -a "$app" "$key=$value" > /dev/null 2>&1 || true
  done < "$ENV_FILE"
}

# Deploy dependency order: api-legacy (DB migrations) → api → worker-orchestrator → worker-browser → mcp-gateway → web
APPS=(
  "apps/api-legacy:jobblitz-api"
  "apps/api:jobblitz-hono"
  "apps/worker-orchestrator:jobblitz-orchestrator"
  "apps/worker-browser:jobblitz-browser-worker"
  "apps/mcp-gateway:jobblitz-mcp-gateway"
  "apps/web:jobblitz-web"
)

declare -a DEPLOYED_URLS=()

for entry in "${APPS[@]}"; do
  dir="${entry%%:*}"
  app="${entry##*:}"
  echo ""
  echo "[deploy] ──────────────────────────────────────────────────────────"
  echo "[deploy] Deploying $app from $dir"
  echo "[deploy] ──────────────────────────────────────────────────────────"

  cd "$ROOT_DIR/$dir"

  set_fly_secrets "$app"

  fly deploy -a "$app" --remote-only

  # Run DB migrations after api-legacy deploy
  if [[ "$app" == "jobblitz-api" ]]; then
    echo "[deploy] Running database migrations..."
    fly ssh console -a "$app" -C "alembic upgrade head" || true
  fi

  echo "[deploy] ✅ $app deployed"
done

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   Deployment Complete                        ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  jobblitz-api             → https://jobblitz-api.fly.dev      ║"
echo "║  jobblitz-hono            → https://jobblitz-hono.fly.dev     ║"
echo "║  jobblitz-web             → https://jobblitz-web.fly.dev      ║"
echo "║  jobblitz-orchestrator    → (internal worker)                ║"
echo "║  jobblitz-browser-worker  → (internal worker)                ║"
echo "║  jobblitz-mcp-gateway     → https://jobblitz-mcp-gateway.fly.dev ║"
echo "╚══════════════════════════════════════════════════════════════╝"
