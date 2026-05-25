import { z } from "zod";
import { eq } from "drizzle-orm";
import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withSpan } from "@jobblitz/observability";

const { users, profiles } = schema;

export function registerGetUserProfile(server: McpServer, db: DatabaseClient): void {
  // @ts-ignore MCP SDK Zod type recursion
  server.tool(
    "get_user_profile",
    { userId: z.string().describe("The UUID of the user") },
    async (args) => {
      return withSpan("mcp.tool.get_user_profile", async () => {
        const [user] = await db.select().from(users).where(eq(users.id, args.userId)).limit(1);
        const [profile] = await db.select().from(profiles).where(eq(profiles.userId, args.userId)).limit(1);

        if (!user) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "User not found" }) }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                plan: user.plan,
                dailyApplyLimit: user.dailyApplyLimit,
                profile: profile ?? null,
              }),
            },
          ],
        };
      });
    }
  );
}
