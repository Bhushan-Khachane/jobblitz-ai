import { schema } from "@jobblitz/db";
import { hybridJobSearch, indexJob, indexUserProfile } from "@jobblitz/memory";
import type { RedisCache } from "@jobblitz/memory";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import Redis from "ioredis";
import { z } from "zod";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";

const { profiles } = schema;

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const memoryRouter = new Hono();

const redis = new Redis(REDIS_URL);

const redisCache: RedisCache = {
  get: async (key) => redis.get(key),
  setex: async (key, seconds, value) => {
    await redis.setex(key, seconds, value);
  },
};

memoryRouter.use("/*", authMiddleware);

const indexJobSchema = z.object({
  jobId: z.string().uuid(),
  jdText: z.string().min(1),
});

memoryRouter.post("/index-job", async (c) => {
  const body = await c.req.json();
  const parsed = indexJobSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  await indexJob(parsed.data.jobId, parsed.data.jdText, db, redisCache);
  return c.json({ success: true });
});

memoryRouter.post("/index-profile", async (c) => {
  const user = c.get("user");

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);
  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  await indexUserProfile(user.id, profile, db, redisCache);
  return c.json({ success: true });
});

memoryRouter.get("/search", async (c) => {
  const user = c.get("user");
  const q = c.req.query("q");
  const limit = Math.min(Number(c.req.query("limit") || "10"), 50);

  if (!q) {
    return c.json({ error: "Query parameter 'q' is required" }, 400);
  }

  const results = await hybridJobSearch(db, redisCache, {
    userId: user.id,
    queryText: q,
    limit,
  });

  return c.json(results);
});

export default memoryRouter;
