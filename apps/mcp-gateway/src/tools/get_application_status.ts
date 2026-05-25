import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const { applications, orchestrationCheckpoints } = schema;

export function registerGetApplicationStatus(server: McpServer, db: DatabaseClient): void {
  // @ts-ignore MCP SDK Zod type recursion
  server.tool(
    "get_application_status",
    {
      applicationId: z.string().describe("The UUID of the application"),
      userId: z.string().describe("The UUID of the user"),
    },
    async (args) => {
      const [application] = await db
        .select()
        .from(applications)
        .where(and(eq(applications.id, args.applicationId), eq(applications.userId, args.userId)))
        .limit(1);

      if (!application) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Application not found" }) }],
          isError: true,
        };
      }

      const [checkpoint] = await db
        .select()
        .from(orchestrationCheckpoints)
        .where(eq(orchestrationCheckpoints.applicationId, args.applicationId))
        .orderBy(desc(orchestrationCheckpoints.updatedAt))
        .limit(1);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              applicationId: application.id,
              jobId: application.jobId,
              status: application.status,
              approvalStatus: application.approvalStatus,
              errorMessage: application.errorMessage,
              checkpoint: checkpoint
                ? {
                    status: checkpoint.status,
                    expiresAt: checkpoint.expiresAt,
                    updatedAt: checkpoint.updatedAt,
                  }
                : null,
            }),
          },
        ],
      };
    }
  );
}
