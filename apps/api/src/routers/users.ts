import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { schema } from "@jobblitz/db";
import { authMiddleware } from "../middleware/auth";

const { users, profiles } = schema;

const usersRouter = new Hono();

usersRouter.use("/*", authMiddleware);

usersRouter.get("/me", async (c) => {
  const user = c.get("user");
  const [u] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!u) return c.json({ error: "User not found" }, 404);

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);

  return c.json({ user: u, profile });
});

usersRouter.patch("/me", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  const { fullName, phone, location, applicationMode, dailyApplyLimit, plan, ...profileFields } = body;

  if (fullName !== undefined || phone !== undefined || location !== undefined || applicationMode !== undefined || dailyApplyLimit !== undefined || plan !== undefined) {
    await db.update(users).set({
      ...(fullName !== undefined ? { fullName } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(applicationMode !== undefined ? { applicationMode } : {}),
      ...(dailyApplyLimit !== undefined ? { dailyApplyLimit } : {}),
      ...(plan !== undefined ? { plan } : {}),
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));
  }

  const [existingProfile] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  if (Object.keys(profileFields).length > 0) {
    if (existingProfile) {
      await db.update(profiles).set({ ...profileFields, updatedAt: new Date() }).where(eq(profiles.userId, user.id));
    } else {
      await db.insert(profiles).values({ ...profileFields, userId: user.id });
    }
  }

  const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const [updatedProfile] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);

  return c.json({ user: updatedUser, profile: updatedProfile });
});

export default usersRouter;
