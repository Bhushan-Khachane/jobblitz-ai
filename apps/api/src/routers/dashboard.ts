import { Hono } from "hono";
import { eq, and, count, avg, sql } from "drizzle-orm";
import { db } from "../db";
import { schema } from "@jobblitz/db";
import { authMiddleware } from "../middleware/auth";

const { jobs, applications, approvals } = schema;

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

export default dashboardRouter;
