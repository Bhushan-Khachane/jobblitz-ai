import { createLogger } from "@jobblitz/observability";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import Redis from "ioredis";
import { db } from "./db";
import {
  registerEnqueueApplication,
  registerGenerateCoverLetter,
  registerGetApplicationStatus,
  registerGetUserProfile,
  registerSearchJobs,
  registerTailorResume,
} from "./tools";

const logger = createLogger("mcp-gateway");

const MCP_API_KEY = process.env.MCP_API_KEY || "";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const redis = new Redis(REDIS_URL);

const redisCache = {
  get: async (key: string): Promise<string | null> => redis.get(key),
  setex: async (
    key: string,
    seconds: number,
    value: string,
  ): Promise<unknown> => {
    return redis.setex(key, seconds, value);
  },
};

export const mcpServer = new McpServer({
  name: "jobblitz-mcp",
  version: "1.0.0",
});

// Register all 6 JobBlitz-specific tools
registerGetUserProfile(mcpServer, db);
registerSearchJobs(mcpServer, db, redisCache);
registerTailorResume(mcpServer, db);
registerGenerateCoverLetter(mcpServer, db);
registerEnqueueApplication(mcpServer, db);
registerGetApplicationStatus(mcpServer, db);

export const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

await mcpServer.connect(transport);

logger.info("MCP server connected to transport", { tools: 6 });

export function validateMcpApiKey(request: Request): boolean {
  if (!MCP_API_KEY) {
    logger.warn("MCP_API_KEY not set — running without auth");
    return true;
  }
  const header = request.headers.get("x-mcp-key");
  return header === MCP_API_KEY;
}
