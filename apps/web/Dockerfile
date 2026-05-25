FROM oven/bun:1.2-slim AS builder
WORKDIR /app
COPY package.json bun.lock* ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN bun install --frozen-lockfile
RUN bun run --filter=@jobblitz/web build

FROM oven/bun:1.2-slim AS runner
WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public
EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
CMD ["bun", "server.js"]
