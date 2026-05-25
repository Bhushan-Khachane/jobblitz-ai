import type { Context, Next } from "hono";
import { auth } from "../auth";

declare module "hono" {
  interface ContextVariableMap {
    user: { id: string; email: string; name?: string };
    session: { id: string; expiresAt: Date };
  }
}

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session || !session.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("user", { id: session.user.id, email: session.user.email, name: session.user.name });
    c.set("session", { id: session.session.id, expiresAt: session.session.expiresAt });
    await next();
    return;
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
}
