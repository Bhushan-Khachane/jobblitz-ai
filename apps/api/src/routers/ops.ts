import { Hono } from "hono";
import { count, avg, gte } from "drizzle-orm";
import Redis from "ioredis";
import { schema } from "@jobblitz/db";
import { authMiddleware } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";
import { db } from "../db";

const { applications, jobs } = schema;

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(REDIS_URL);

const ops = new Hono();

ops.use("/*", authMiddleware);
ops.use("/*", adminMiddleware);

ops.get("/metrics", async (c) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [appsToday] = await db
    .select({ total: count() })
    .from(applications)
    .where(gte(applications.createdAt, today));

  const [avgScore] = await db
    .select({ avgScore: avg(jobs.matchScore) })
    .from(jobs);

  const llmCallsLastHour = await redis.zcount(
    "llm_calls:*",
    String(Date.now() - 60 * 60 * 1000),
    String(Date.now())
  ).catch(() => 0);

  const activeBrowserSessions = await redis.get("browser:active_sessions").catch(() => "0");

  const errorLog = await redis.lrange("error:log", 0, 9).catch(() => []);

  // BullMQ queue depths (approximate via Redis keys)
  const queuePrefix = "bullmq:orchestration-jobs:";
  const [waiting, active, completed, failed] = await Promise.all([
    redis.llen(`${queuePrefix}wait`),
    redis.llen(`${queuePrefix}active`),
    redis.get(`${queuePrefix}meta:completed`).then((v) => (v ? Number(v) : 0)),
    redis.get(`${queuePrefix}meta:failed`).then((v) => (v ? Number(v) : 0)),
  ]).catch(() => [0, 0, 0, 0]);

  return c.json({
    queueDepths: { waiting, active, completed, failed },
    applicationsToday: appsToday?.total ?? 0,
    avgMatchScore: avgScore?.avgScore ? Math.round(Number(avgScore.avgScore)) : 0,
    llmCallsLastHour: typeof llmCallsLastHour === "number" ? llmCallsLastHour : 0,
    activeBrowserSessions: Number(activeBrowserSessions) || 0,
    recentErrors: errorLog.map((e) => JSON.parse(e)),
  });
});

export default ops;
