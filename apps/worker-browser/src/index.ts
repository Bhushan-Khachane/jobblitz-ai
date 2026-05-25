import { Hono } from "hono";
import { sessionManager } from "./session";
import { navigate, act, applyWithAdapter } from "./playwright";
import { artifacts } from "./artifacts";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({ status: "ok", service: "worker-browser", version: "2.0.0", sessions: sessionManager.listSessions().length });
});

app.post("/session", async (c) => {
  const body = await c.req.json();
  const session = await sessionManager.createSession(body.headless ?? true, body.proxy);
  return c.json({ sessionId: session.id, createdAt: session.createdAt }, 201);
});

app.delete("/session/:id", async (c) => {
  const id = c.req.param("id");
  await sessionManager.closeSession(id);
  return c.json({ success: true });
});

app.get("/sessions", (c) => {
  return c.json(sessionManager.listSessions());
});

app.post("/navigate", async (c) => {
  const body = await c.req.json();
  const result = await navigate(body);
  return c.json(result, result.success ? 200 : 500);
});

app.post("/act", async (c) => {
  const body = await c.req.json();
  const result = await act(body);
  return c.json(result, result.success ? 200 : 500);
});

app.post("/screenshot", async (c) => {
  const body = await c.req.json();
  const session = sessionManager.getSession(body.sessionId);
  if (!session) return c.json({ error: "Session not found" }, 404);
  const shot = await artifacts.screenshot(session.page, body.prefix || "screenshot");
  return c.json({ path: shot.path });
});

app.post("/apply", async (c) => {
  const body = await c.req.json();
  const result = await applyWithAdapter(body);
  return c.json(result, result.success ? 200 : 500);
});

app.post("/extract", async (c) => {
  const body = await c.req.json();
  const session = sessionManager.getSession(body.sessionId);
  if (!session) return c.json({ error: "Session not found" }, 404);

  try {
    const dom = await artifacts.domSnapshot(session.page, body.prefix || "extract");
    const text = await session.page.evaluate(() => document.body.innerText);
    return c.json({ domPath: dom.path, text: text.slice(0, 10000) });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

const port = Number(process.env.PORT) || 8002;
console.log(`[worker-browser] starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
