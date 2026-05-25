import { Hono } from "hono";
import { eq, and, count, avg, sql } from "drizzle-orm";
import { db } from "../db";
import { schema } from "@jobblitz/db";
import { authMiddleware } from "../middleware/auth";
import Redis from "ioredis";

const { jobs, applications, approvals } = schema;

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const dashboardRouter = new Hono();

dashboardRouter.use("/*", authMiddleware);

dashboardRouter.get("/stats", async (c) => {
  const user = c.get("user");

  const [jobsResult] = await db
    .select({ total: count() })
    .from(jobs)
    .where(eq(jobs.userId, user.id));

  const [applicationsResult] = await db
    .select({ total: count() })
    .from(applications)
    .where(eq(applications.userId, user.id));

  const [pendingApprovalsResult] = await db
    .select({ total: count() })
    .from(approvals)
    .where(and(eq(approvals.userId, user.id), eq(approvals.status, "pending")));

  const [matchScoreResult] = await db
    .select({ avg: avg(jobs.matchScore) })
    .from(jobs)
    .where(and(eq(jobs.userId, user.id), sql`${jobs.matchScore} is not null`));

  return c.json({
    totalJobs: jobsResult?.total ?? 0,
    totalApplications: applicationsResult?.total ?? 0,
    pendingApprovals: pendingApprovalsResult?.total ?? 0,
    avgMatchScore: matchScoreResult?.avg ? Math.round(Number(matchScoreResult.avg)) : 0,
  });
});

dashboardRouter.get("/stream", async (c) => {
  const user = c.get("user");

  const stream = new ReadableStream({
    start(controller) {
      const subscriber = new Redis(REDIS_URL);

      const sendEvent = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(new TextEncoder().encode(payload));
      };

      // Send initial connection ping
      sendEvent("connected", { userId: user.id, timestamp: Date.now() });

      subscriber.subscribe(
        `jobblitz:notifications:${user.id}`,
        "jobblitz:approvals"
      );

      subscriber.on("message", (channel, message) => {
        try {
          const parsed = JSON.parse(message) as Record<string, unknown>;

          if (channel === "jobblitz:approvals") {
            if (parsed.userId === user.id) {
              sendEvent("approval", parsed);
            }
          } else if (channel.startsWith("jobblitz:notifications:")) {
            sendEvent("notification", parsed);
          }
        } catch {
          // Ignore malformed JSON from Redis
        }
      });

      subscriber.on("error", (err: Error) => {
        sendEvent("error", { message: err.message });
      });

      const cleanup = () => {
        try {
          subscriber.unsubscribe();
          subscriber.disconnect();
        } catch {
          // Best-effort cleanup
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      c.req.raw.signal.addEventListener("abort", cleanup);
    },
  });

  return c.body(stream, 200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
});

export default dashboardRouter;
