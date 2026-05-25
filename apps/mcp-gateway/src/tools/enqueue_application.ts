import { z } from "zod";
import { eq, and, count, gte } from "drizzle-orm";
import { Queue } from "bullmq";
import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";
import { applicationRateLimit } from "@jobblitz/security";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const { users, applications, jobs } = schema;

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const orchestrationQueue = new Queue("orchestration-jobs", {
  connection: new (await import("ioredis")).default(REDIS_URL),
});

export function registerEnqueueApplication(server: McpServer, db: DatabaseClient): void {
  // @ts-ignore MCP SDK Zod type recursion
  server.tool(
    "enqueue_application",
    {
      userId: z.string().describe("The UUID of the user"),
      jobId: z.string().describe("The UUID of the job to apply for"),
    },
    async (args) => {
      const [user] = await db.select().from(users).where(eq(users.id, args.userId)).limit(1);
      if (!user) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "User not found" }) }],
          isError: true,
        };
      }

      const [job] = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, args.jobId), eq(jobs.userId, args.userId)))
        .limit(1);
      if (!job) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Job not found" }) }],
          isError: true,
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const getDailyLimit = async () => user.dailyApplyLimit;
      const getTodayCount = async () => {
        const result = await db
          .select({ total: count() })
          .from(applications)
          .where(
            and(
              eq(applications.userId, args.userId),
              gte(applications.createdAt, today)
            )
          );
        return result[0]?.total ?? 0;
      };

      const rateLimit = await applicationRateLimit(args.userId, getDailyLimit, getTodayCount);
      if (!rateLimit.allowed) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: "Daily application limit reached", remaining: rateLimit.remaining }) },
          ],
          isError: true,
        };
      }

      const [application] = await db
        .insert(applications)
        .values({
          userId: args.userId,
          jobId: args.jobId,
          status: "pending",
        })
        .returning();

      await orchestrationQueue.add("apply", {
        applicationId: application?.id,
        userId: args.userId,
        jobId: args.jobId,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              applicationId: application?.id,
              remaining: rateLimit.remaining - 1,
            }),
          },
        ],
      };
    }
  );
}
