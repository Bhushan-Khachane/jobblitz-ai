FROM oven/bun:1.2-slim AS builder
WORKDIR /app
COPY package.json bun.lock* ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN bun install --frozen-lockfile
RUN bun run --filter=@jobblitz/api build

FROM oven/bun:1.2-slim AS runner
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8000
CMD ["bun", "dist/index.js"]
