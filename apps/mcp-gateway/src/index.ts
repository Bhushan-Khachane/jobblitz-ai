import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({ status: "ok", service: "mcp-gateway", version: "2.0.0" });
});

export default {
  port: 8003,
  fetch: app.fetch,
};
