# gstack Browser Worker Setup

## Prerequisites

- macOS or Linux
- `curl` and `git` installed
- Docker (for running the browser worker container)

## Installation

Run the setup script from the repo root:

```bash
bash apps/browser-worker/setup.sh
```

This script will:

1. Install `bun` if not present
2. Clone gstack to `~/.claude/skills/gstack` if not present
3. Build the `browse` binary via `./setup`
4. Verify the binary exists at `~/.claude/skills/gstack/browse/dist/browse`

## Manual Steps (if script fails)

```bash
# 1. Install bun
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

# 2. Clone gstack
git clone https://github.com/garrytan/gstack.git ~/.claude/skills/gstack

# 3. Build
cd ~/.claude/skills/gstack
./setup

# 4. Verify
ls -la ~/.claude/skills/gstack/browse/dist/browse
```

## Docker Setup

The browser-worker service runs inside Docker with Chromium pre-installed:

```bash
docker compose -f infra/docker/docker-compose.yml up browser-worker
```

The service exposes port `8002` and mounts a persistent volume for browser sessions:

```yaml
volumes:
  - gstack-sessions:/root/.gstack
```

## Environment Variables

Add to your `.env`:

```env
BROWSER_WORKER_URL=http://browser-worker:8002
```

## Verification

```bash
curl http://localhost:8002/health
```

Expected response:

```json
{"status": "ok", "service": "browser-worker"}
```
