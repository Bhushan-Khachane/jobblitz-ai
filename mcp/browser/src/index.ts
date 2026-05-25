import { createMcpServer } from "@jobblitz/mcp-runtime";

const BROWSER_WORKER_URL = process.env.BROWSER_WORKER_URL || "http://localhost:8002";

async function browserAction(endpoint: string, payload: Record<string, unknown>) {
  const res = await fetch(`${BROWSER_WORKER_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Browser worker error: ${res.status}`);
  return res.json();
}

createMcpServer("browser", [
  {
    name: "navigate",
    description: "Navigate a browser session to a URL",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        url: { type: "string" },
      },
      required: ["sessionId", "url"],
    },
    async handler(args: unknown) {
      const { sessionId, url } = args as { sessionId: string; url: string };
      return browserAction("/navigate", { sessionId, url });
    },
  },
  {
    name: "screenshot",
    description: "Take a screenshot of the current page",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        prefix: { type: "string" },
      },
      required: ["sessionId"],
    },
    async handler(args: unknown) {
      const { sessionId, prefix } = args as { sessionId: string; prefix?: string };
      return browserAction("/screenshot", { sessionId, prefix });
    },
  },
  {
    name: "act",
    description: "Perform an action on the page (click, fill, select, scroll, wait)",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        action: { type: "string", enum: ["click", "fill", "select", "scroll", "wait"] },
        selector: { type: "string" },
        value: { type: "string" },
      },
      required: ["sessionId", "action"],
    },
    async handler(args: unknown) {
      const payload = args as { sessionId: string; action: string; selector?: string; value?: string };
      return browserAction("/act", payload);
    },
  },
]);
