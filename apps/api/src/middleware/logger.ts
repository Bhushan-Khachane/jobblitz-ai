import type { Context, Next } from "hono";

export async function loggerMiddleware(c: Context, next: Next) {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  const status = c.res.status;
  console.log(`${c.req.method} ${c.req.path} ${status} ${duration}ms`);
}
