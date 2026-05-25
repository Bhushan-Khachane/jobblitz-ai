FROM oven/bun:1.2-slim AS builder
WORKDIR /app
COPY package.json bun.lock* ./
COPY packages ./packages
COPY apps/worker-orchestrator ./apps/worker-orchestrator
RUN bun install --frozen-lockfile
RUN bun run --filter=@jobblitz/worker-orchestrator build

FROM oven/bun:1.2-slim AS runner
WORKDIR /app
COPY --from=builder /app/apps/worker-orchestrator/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["bun", "dist/index.js"]
