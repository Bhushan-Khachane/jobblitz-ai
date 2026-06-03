import { Hono } from "hono";
import Redis from "ioredis";
import { db } from "../db";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const health = new Hono();

health.get("/", async (c) => {
  let dbStatus: "ok" | "unreachable" = "ok";
  let redisStatus: "ok" | "unreachable" = "ok";

  try {
    await db.execute("select 1");
  } catch {
    dbStatus = "unreachable";
  }

  try {
    const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    await redis.ping();
    redis.disconnect();
  } catch {
    redisStatus = "unreachable";
  }

  const llmStatus = process.env.OPENAI_API_KEY ? "ok" : "no_key";

  const overall = dbStatus === "ok" && redisStatus === "ok" ? "ok" : "degraded";

  return c.json({
    status: overall,
    service: "api",
    version: "2.1.0",
    checks: {
      db: dbStatus,
      redis: redisStatus,
      llm: llmStatus,
    },
  });
});

health.get("/ready", async (c) => {
  try {
    await db.execute("select 1");
    return c.json({ ready: true });
  } catch {
    return c.json({ ready: false }, 503);
  }
});

export default health;
