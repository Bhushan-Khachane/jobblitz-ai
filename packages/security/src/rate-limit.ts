import type { Context } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs = 60000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt: now + this.windowMs };
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: this.maxRequests - entry.count, resetAt: entry.resetAt };
  }

  middleware() {
    const limiter = this;
    return async (c: Context, next: () => Promise<void>): Promise<Response | void> => {
      const key = c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip") || "anonymous";
      const result = limiter.isAllowed(key);

      c.header("X-RateLimit-Limit", String(limiter.maxRequests));
      c.header("X-RateLimit-Remaining", String(result.remaining));
      c.header("X-RateLimit-Reset", String(result.resetAt));

      if (!result.allowed) {
        return c.json({ error: "Rate limit exceeded" }, 429);
      }

      await next();
      return;
    };
  }
}
