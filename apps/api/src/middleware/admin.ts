import type { Context, Next } from "hono";
import { eq } from "drizzle-orm";
import { schema } from "@jobblitz/db";
import { db } from "../db";

const { users } = schema;

export async function adminMiddleware(c: Context, next: Next): Promise<Response | void> {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const [dbUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, user.id)).limit(1);

  if (!dbUser || dbUser.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  await next();
  return;
}
