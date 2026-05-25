import { z } from "zod";
import type { DatabaseClient } from "@jobblitz/db";
import { hybridJobSearch } from "@jobblitz/memory";
import type { RedisCache } from "@jobblitz/memory";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSearchJobs(server: McpServer, db: DatabaseClient, redis: RedisCache): void {
  // @ts-ignore MCP SDK Zod type recursion
  server.tool(
    "search_jobs",
    {
      userId: z.string().describe("The UUID of the user"),
      query: z.string().describe("Natural language query or job description keywords"),
      limit: z.number().optional().describe("Max results (default 10, max 50)"),
    },
    async (args) => {
      const limit = Math.min(args.limit ?? 10, 50);
      const results = await hybridJobSearch(db, redis, {
        userId: args.userId,
        queryText: args.query,
        limit,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(results) }],
      };
    }
  );
}
