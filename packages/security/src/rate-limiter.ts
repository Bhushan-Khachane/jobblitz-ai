import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { schema } from "@jobblitz/db";
import type { DatabaseClient } from "@jobblitz/db";

const { subscriptions } = schema;

// ── Plan limits ─────────────────────────────────────────────────────────────

const PLAN_LIMITS: Record<string, number | null> = {
  free: 10,
  pro: 50,
  elite: null, // unlimited
};

export function getDailyLimitFromPlan(plan: string): number | null {
  return PLAN_LIMITS[plan] ?? 10;
}

export async function getUserPlanDailyLimit(
  db: DatabaseClient,
  userId: string,
): Promise<number | null> {
  const [sub] = await db
    .select({ plan: subscriptions.plan })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  return getDailyLimitFromPlan(sub?.plan ?? "free");
}

// ── Application rate limit (DB-backed) ──────────────────────────────────────

export interface ApplicationRateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function applicationRateLimit(
  _userId: string,
  getDailyLimit: () => Promise<number>,
  getTodayCount: () => Promise<number>,
): Promise<ApplicationRateLimitResult> {
  const limit = await getDailyLimit();
  const count = await getTodayCount();
  const remaining = Math.max(0, limit - count);
  return { allowed: remaining > 0, remaining };
}

// ── LLM rate limit (Redis-backed sliding window) ──────────────────────────────

export interface LlmRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function llmRateLimit(
  userId: string,
  redis: {
    zadd: (key: string, ...args: unknown[]) => Promise<unknown>;
    zcount: (key: string, min: string, max: string) => Promise<number>;
    expire: (key: string, seconds: number) => Promise<unknown>;
  },
): Promise<LlmRateLimitResult> {
  const WINDOW_MS = 60 * 60 * 1000; // 1 hour
  const MAX_CALLS = 100;
  const key = `llm_rate:${userId}`;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  await redis.zadd(key, now, `${now}-${Math.random().toString(36).slice(2)}`);
  await redis.expire(key, 3600);

  const count = await redis.zcount(key, String(windowStart), String(now));
  const remaining = Math.max(0, MAX_CALLS - count);

  return {
    allowed: remaining > 0,
    remaining,
    resetAt: now + WINDOW_MS,
  };
}

// ── In-memory HTTP rate limiter (legacy, kept for API middleware) ─────────────

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

  isAllowed(key: string): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
  } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt: now + this.windowMs,
      };
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  middleware() {
    return async (
      c: Context,
      next: () => Promise<void>,
    ): Promise<Response | void> => {
      const key =
        c.req.header("x-forwarded-for") ||
        c.req.header("cf-connecting-ip") ||
        "anonymous";
      const result = this.isAllowed(key);

      c.header("X-RateLimit-Limit", String(this.maxRequests));
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
