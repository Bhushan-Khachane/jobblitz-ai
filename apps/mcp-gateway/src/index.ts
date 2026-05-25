import { Hono } from "hono";
import { cors } from "hono/cors";
import { initTracer, initMetrics } from "@jobblitz/observability";
import { transport, validateMcpApiKey } from "./server";

initTracer("mcp-gateway");
initMetrics("mcp-gateway");

const PORT = Number(process.env.PORT || "4000");

const app = new Hono();

app.use(
  cors({
    origin: [
      typeof process !== "undefined"
        ? process.env.WEB_URL || "http://localhost:3000"
        : "http://localhost:3000",
    ],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-mcp-key",
      "mcp-protocol-version",
    ],
    credentials: true,
  }),
);

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "mcp-gateway",
    version: "2.0.0",
    tools: 6,
  });
});

app.all("/mcp", async (c) => {
  if (!validateMcpApiKey(c.req.raw)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return transport.handleRequest(c.req.raw);
});

app.onError((err, c) => {
  console.error(
    JSON.stringify({ level: "error", path: c.req.path, error: err.message }),
  );
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

console.log(`[mcp-gateway] starting on port ${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
