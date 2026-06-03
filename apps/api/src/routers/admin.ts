import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";
import {
  applicationQueue,
  dailyJobHuntQueue,
  complianceFilterQueue,
  coachHandoffQueue,
  profileIngestionQueue,
} from "../queue";

const admin = new Hono();

admin.use("/*", authMiddleware);
admin.use("/*", adminMiddleware);

admin.get("/queues", async (c) => {
  const queues = [
    applicationQueue,
    dailyJobHuntQueue,
    complianceFilterQueue,
    coachHandoffQueue,
    profileIngestionQueue,
  ];

  const metrics = await Promise.all(
    queues.map(async (q) => {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        q.getWaitingCount(),
        q.getActiveCount(),
        q.getCompletedCount(),
        q.getFailedCount(),
        q.getDelayedCount(),
      ]);
      return {
        name: q.name,
        waiting,
        active,
        completed,
        failed,
        delayed,
      };
    })
  );

  return c.json({ queues: metrics });
});

// ── Bull Board proxy ──
// Bull Board runs as a separate Express server (see ../bull-board.ts).
// We proxy all /admin/board/* traffic to it so operators have a single entrypoint.
const BOARD_PORT = Number(process.env.BULL_BOARD_PORT) || 8001;

admin.all("/board/*", async (c) => {
  const targetPath = c.req.path.replace("/admin/board", "/admin/board");
  const targetUrl = `http://localhost:${BOARD_PORT}${targetPath}`;

  const headers = new Headers(c.req.raw.headers);
  headers.delete("host");

  const method = c.req.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  const res = await fetch(targetUrl, {
    method,
    headers,
    ...(hasBody ? { body: c.req.raw.body } : {}),
    redirect: "manual",
  });

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
});

export default admin;
