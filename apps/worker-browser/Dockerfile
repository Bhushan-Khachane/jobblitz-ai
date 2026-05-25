FROM oven/bun:1.2-slim AS builder
WORKDIR /app
COPY package.json bun.lock* ./
COPY packages ./packages
COPY apps/worker-browser ./apps/worker-browser
RUN bun install --frozen-lockfile
RUN bun run --filter=@jobblitz/worker-browser build

FROM oven/bun:1.2-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y chromium
COPY --from=builder /app/apps/worker-browser/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib/chromium
EXPOSE 8002
CMD ["bun", "dist/index.js"]
