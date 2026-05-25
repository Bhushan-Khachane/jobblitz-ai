import { Hono } from "hono";
import { db } from "../db";

const health = new Hono();

health.get("/", async (c) => {
  let dbStatus: "ok" | "unreachable" = "ok";
  try {
    await db.execute("select 1");
  } catch {
    dbStatus = "unreachable";
  }

  return c.json({
    status: dbStatus === "ok" ? "ok" : "degraded",
    service: "api",
    version: "2.0.0",
    db: dbStatus,
  });
});

export default health;
