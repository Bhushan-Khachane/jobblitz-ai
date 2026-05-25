import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

// ── Config ──────────────────────────────────────────────────────────────────

const API_KEY = typeof process !== "undefined" ? (process.env.MCP_GATEWAY_API_KEY || "") : "";
const PORT = typeof process !== "undefined" ? Number(process.env.PORT || "8003") : 8003;

// ── Types ───────────────────────────────────────────────────────────────────

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  server: string;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ── Tool registry (populated at startup via discovery) ───────────────────────

const toolRegistry = new Map<string, McpTool>();

// Hardcoded registry for internal MCP servers
// In production, this would be discovered via service mesh or config
const MCP_SERVERS: Record<string, string> = {
  postgres: "http://localhost:8004",
  files: "http://localhost:8005",
  browser: "http://localhost:8006",
  email: "http://localhost:8007",
  calendar: "http://localhost:8008",
  research: "http://localhost:8009",
};

// ── Logger ────────────────────────────────────────────────────────────────────

function log(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...meta }));
}

// ── Auth middleware ───────────────────────────────────────────────────────────

async function apiKeyAuth(c: import("hono").Context, next: import("hono").Next): Promise<Response | void> {
  if (!API_KEY) {
    log("warn", "MCP_GATEWAY_API_KEY not set — running without auth");
    return await next();
  }
  const header = c.req.header("x-api-key");
  if (header !== API_KEY) {
    log("warn", "Unauthorized request", { ip: c.req.header("x-forwarded-for") });
    return c.json({ error: "Unauthorized" }, 401);
  }
  return await next();
}

// ── Rate limiting (simple in-memory) ──────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

async function rateLimit(c: import("hono").Context, next: import("hono").Next): Promise<Response | void> {
  const key = c.req.header("x-api-key") || c.req.header("x-forwarded-for") || "anonymous";
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 100;

  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    entry.count++;
    if (entry.count > maxRequests) {
      log("warn", "Rate limit exceeded", { key });
      return c.json({ error: "Rate limit exceeded" }, 429);
    }
  }
  return await next();
}

// ── MCP client ────────────────────────────────────────────────────────────────

async function mcpJsonRpc(serverUrl: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const res = await fetch(`${serverUrl}/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(`MCP server returned ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<JsonRpcResponse>;
}

async function discoverTools(): Promise<void> {
  toolRegistry.clear();
  for (const [serverName, url] of Object.entries(MCP_SERVERS)) {
    try {
      const res = await mcpJsonRpc(url, {
        jsonrpc: "2.0",
        id: `discover-${serverName}`,
        method: "tools/list",
      });
      const tools = (res.result as { tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> } | undefined)?.tools || [];
      for (const tool of tools) {
        toolRegistry.set(tool.name, { ...tool, server: serverName });
      }
      log("info", `Discovered ${tools.length} tools from ${serverName}`);
    } catch (err) {
      log("warn", `Failed to discover tools from ${serverName}`, { error: err instanceof Error ? err.message : String(err) });
    }
  }
}

// ── Validation schemas ────────────────────────────────────────────────────────

const callToolSchema = z.object({
  arguments: z.record(z.unknown()).default({}),
});

// ── App ───────────────────────────────────────────────────────────────────────

const app = new Hono();

app.use(cors({
  origin: [typeof process !== "undefined" ? (process.env.WEB_URL || "http://localhost:3000") : "http://localhost:3000"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
  credentials: true,
}));

app.use(apiKeyAuth);
app.use(rateLimit);

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "mcp-gateway",
    version: "2.0.0",
    toolsRegistered: toolRegistry.size,
    servers: Object.keys(MCP_SERVERS),
  });
});

app.get("/tools", (c) => {
  const tools = Array.from(toolRegistry.values()).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    server: t.server,
  }));
  return c.json({ tools });
});

app.get("/tools/:name", (c) => {
  const name = c.req.param("name");
  const tool = toolRegistry.get(name);
  if (!tool) return c.json({ error: "Tool not found" }, 404);
  return c.json(tool);
});

app.post("/tools/:name", async (c) => {
  const name = c.req.param("name");
  const tool = toolRegistry.get(name);
  if (!tool) return c.json({ error: "Tool not found" }, 404);

  const body = await c.req.json();
  const parsed = callToolSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request body", details: parsed.error.flatten() }, 400);
  }

  const serverUrl = MCP_SERVERS[tool.server];
  if (!serverUrl) {
    return c.json({ error: `Server ${tool.server} not configured` }, 500);
  }

  try {
    const res = await mcpJsonRpc(serverUrl, {
      jsonrpc: "2.0",
      id: `${name}-${Date.now()}`,
      method: "tools/call",
      params: { name, arguments: parsed.data.arguments },
    });

    if (res.error) {
      log("error", `Tool ${name} error`, { code: res.error.code, message: res.error.message });
      return c.json({ error: res.error.message, code: res.error.code }, 500);
    }

    return c.json(res.result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("error", `Tool ${name} invocation failed`, { error: message });
    return c.json({ error: "Tool invocation failed", message }, 500);
  }
});

// ── Error handler ─────────────────────────────────────────────────────────────

app.onError((err, c) => {
  log("error", "Unhandled error", { path: c.req.path, error: err.message });
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

// ── Startup ─────────────────────────────────────────────────────────────────

console.log(`[mcp-gateway] starting on port ${PORT}`);
discoverTools().catch((err) => {
  log("error", "Initial tool discovery failed", { error: err instanceof Error ? err.message : String(err) });
});

export default {
  port: PORT,
  fetch: app.fetch,
};
