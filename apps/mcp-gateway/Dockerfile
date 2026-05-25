FROM oven/bun:1.2-slim AS builder
WORKDIR /app
COPY package.json bun.lock* ./
COPY packages ./packages
COPY apps/mcp-gateway ./apps/mcp-gateway
RUN bun install --frozen-lockfile
RUN bun run --filter=@jobblitz/mcp-gateway build

FROM oven/bun:1.2-slim AS runner
WORKDIR /app
COPY --from=builder /app/apps/mcp-gateway/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8003
CMD ["bun", "dist/index.js"]
