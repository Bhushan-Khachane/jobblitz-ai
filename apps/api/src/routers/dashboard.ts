import { Hono } from "hono";
import { eq, and, count, avg, sql } from "drizzle-orm";
import { db } from "../db";
import { schema } from "@jobblitz/db";
import { authMiddleware } from "../middleware/auth";
import Redis from "ioredis";

const { jobs, applications, approvals, users, subscriptions, plans, usageCounters } = schema;

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

dashboardRouter.get("/saas-metrics", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [totalUsersCount] = await db.select({ value: count() }).from(users);

  const subsByPlan = await db
    .select({
      plan: plans.name,
      count: count(),
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.status, "active"))
    .groupBy(plans.name);

  const [mrr] = await db
    .select({
      total: sql<number>`sum(${plans.priceInr})`,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.status, "active"));

  const portalSuccess = await db
    .select({
      platform: jobs.platform,
      success_rate: sql<number>`count(CASE WHEN ${applications.status} = 'submitted' THEN 1 END)::float / count(*)`,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .groupBy(jobs.platform);

  const topUsers = await db
    .select({
      userId: applications.userId,
      count: count(),
    })
    .from(applications)
    .groupBy(applications.userId)
    .orderBy(sql`count(*) DESC`)
    .limit(10);

  return c.json({
    total_users: totalUsersCount?.value ?? 0,
    active_subscriptions_by_plan: subsByPlan,
    mrr_inr: mrr?.total ?? 0,
    portal_success_rate: portalSuccess,
    top_10_users_by_applications: topUsers,
  });
});

dashboardRouter.get("/my-stats", async (c) => {
  const user = c.get("user");
  const todayStr = new Date().toISOString().split("T")[0];
  if (!todayStr) return c.json({ error: "Invalid date" }, 500);

  const [usage] = await db
    .select()
    .from(usageCounters)
    .where(and(eq(usageCounters.userId, user.id), eq(usageCounters.date, todayStr)))
    .limit(1);

  const [plan] = await db
    .select({
      dailyApplyCap: plans.dailyApplyCap,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.userId, user.id))
    .limit(1);

  const funnel = await db
    .select({
      status: applications.status,
      count: count(),
    })
    .from(applications)
    .where(eq(applications.userId, user.id))
    .groupBy(applications.status);

  return c.json({
    applies_today: usage?.appliesCount ?? 0,
    quota_remaining: (plan?.dailyApplyCap ?? 3) - (usage?.appliesCount ?? 0),
    application_funnel: funnel,
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
