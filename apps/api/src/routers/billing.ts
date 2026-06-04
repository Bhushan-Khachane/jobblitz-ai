import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { schema } from "@jobblitz/db";
import { authMiddleware } from "../middleware/auth";
import crypto from "node:crypto";

const billingRouter = new Hono();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

billingRouter.post(
  "/create-subscription",
  authMiddleware,
  zValidator(
    "json",
    z.object({
      planId: z.string().uuid(),
    })
  ),
  async (c) => {
    const { planId } = c.req.valid("json");

    const [plan] = await db
      .select()
      .from(schema.plans)
      .where(eq(schema.plans.id, planId))
      .limit(1);

    if (!plan) {
      return c.json({ error: "Plan not found" }, 404);
    }

    // Razorpay Subscription API call
    const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(
          `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
        ).toString("base64")}`,
      },
      body: JSON.stringify({
        plan_id: planId, // In real world, this would be Razorpay's plan ID
        customer_notify: 1,
        total_count: 12, // 1 year
      }),
    });

    const data = (await response.json()) as any;

    return c.json({
      subscriptionId: data.id,
      shortUrl: data.short_url,
    });
  }
);

billingRouter.post("/webhook", async (c) => {
  const signature = c.req.header("x-razorpay-signature");
  const body = await c.req.text();

  if (!signature || !RAZORPAY_WEBHOOK_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  if (signature !== expectedSignature) {
    console.error("Invalid signature. Expected:", expectedSignature, "Received:", signature);
    return c.json({ error: "Invalid signature" }, 401);
  }

  const event = JSON.parse(body);

  switch (event.event) {
    case "subscription.activated":
    case "subscription.charged": {
      const sub = event.payload.subscription.entity;
      const notes = sub.notes || {};
      const userId = notes.userId;

      if (userId) {
        await db
          .insert(schema.subscriptions)
          .values({
            userId,
            razorpaySubscriptionId: sub.id,
            status: "active",
            currentPeriodStart: new Date(sub.current_start * 1000),
            currentPeriodEnd: new Date(sub.current_end * 1000),
          } as any)
          .onConflictDoUpdate({
            target: schema.subscriptions.userId,
            set: {
              status: "active",
              currentPeriodStart: new Date(sub.current_start * 1000),
              currentPeriodEnd: new Date(sub.current_end * 1000),
              updatedAt: new Date(),
            },
          });
      }
      break;
    }
    case "subscription.cancelled": {
      const sub = event.payload.subscription.entity;
      await db
        .update(schema.subscriptions)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(schema.subscriptions.razorpaySubscriptionId, sub.id));
      break;
    }
  }

  return c.json({ status: "ok" });
});

billingRouter.get("/status", authMiddleware, async (c) => {
  const user = c.get("user");
  const todayStr = new Date().toISOString().split("T")[0];
  if (!todayStr) return c.json({ error: "Invalid date" }, 500);

  const [subscription] = await db
    .select({
      status: schema.subscriptions.status,
      currentPeriodEnd: schema.subscriptions.currentPeriodEnd,
      planName: schema.plans.name,
    })
    .from(schema.subscriptions)
    .leftJoin(schema.plans, eq(schema.subscriptions.planId, schema.plans.id))
    .where(eq(schema.subscriptions.userId, user.id))
    .limit(1);

  const [usage] = await db
    .select()
    .from(schema.usageCounters)
    .where(
      and(
        eq(schema.usageCounters.userId, user.id),
        eq(schema.usageCounters.date, todayStr)
      )
    )
    .limit(1);

  return c.json({
    plan: subscription?.planName || "free",
    status: subscription?.status || "inactive",
    nextRenewalDate: subscription?.currentPeriodEnd,
    usageToday: {
      applies: usage?.appliesCount ?? 0,
      discoveries: usage?.discoveriesCount ?? 0,
    },
  });
});

export default billingRouter;
