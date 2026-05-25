import { RateLimiter } from "@jobblitz/security";
import type { Context, Next } from "hono";

const limiter = new RateLimiter(60_000, 120);

export async function rateLimitMiddleware(c: Context, next: Next): Promise<Response | void> {
  const key = c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip") || "anonymous";
  const result = limiter.isAllowed(key);

  c.header("X-RateLimit-Limit", "120");
  c.header("X-RateLimit-Remaining", String(result.remaining));
  c.header("X-RateLimit-Reset", String(result.resetAt));

  if (!result.allowed) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  await next();
  return;
}
