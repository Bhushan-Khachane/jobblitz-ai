import type { Context } from "hono";

export async function errorHandler(err: Error, c: Context) {
  console.error("[error]", err);
  const status = (err as unknown as { status?: number }).status || 500;
  const message = status === 500 ? "Internal server error" : err.message;
  return c.json({ error: message, status }, status as never);
}

export async function notFoundHandler(c: Context) {
  return c.json({ error: "Not found", path: c.req.path }, 404);
}
