import { eq, and } from "drizzle-orm";
import { schema, createDatabaseClient } from "@jobblitz/db";

const db = createDatabaseClient(process.env.DATABASE_URL!);

export async function getUserPlan(userId: string) {
  const [subscription] = await db
    .select({
      plan: schema.plans,
    })
    .from(schema.subscriptions)
    .innerJoin(schema.plans, eq(schema.subscriptions.planId, schema.plans.id))
    .where(
      and(
        eq(schema.subscriptions.userId, userId),
        eq(schema.subscriptions.status, "active")
      )
    )
    .limit(1);

  if (subscription) {
    return subscription.plan;
  }

  // Fallback to free plan if no active subscription
  const [freePlan] = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.name, "free"))
    .limit(1);

  return freePlan || null;
}

export async function checkAndIncrementQuota(
  userId: string,
  action: "apply" | "discovery"
): Promise<boolean> {
  const plan = await getUserPlan(userId);
  if (!plan) return false;

  const todayStr = new Date().toISOString().split("T")[0];
  if (!todayStr) return false;

  // Get current usage
  const [usage] = await db
    .select()
    .from(schema.usageCounters)
    .where(
      and(
        eq(schema.usageCounters.userId, userId),
        eq(schema.usageCounters.date, todayStr)
      )
    )
    .limit(1);

  const currentCount = action === "apply"
    ? (usage?.appliesCount ?? 0)
    : (usage?.discoveriesCount ?? 0);

  const cap = action === "apply" ? plan.dailyApplyCap : 100; // Discovery cap default or from plan if added

  if (currentCount >= cap) {
    return false;
  }

  // Increment usage
  if (!usage) {
    await db.insert(schema.usageCounters).values({
      userId,
      date: todayStr,
      appliesCount: action === "apply" ? 1 : 0,
      discoveriesCount: action === "discovery" ? 1 : 0,
    });
  } else {
    await db
      .update(schema.usageCounters)
      .set({
        appliesCount: action === "apply" ? usage.appliesCount + 1 : usage.appliesCount,
        discoveriesCount: action === "discovery" ? usage.discoveriesCount + 1 : usage.discoveriesCount,
      })
      .where(eq(schema.usageCounters.id, usage.id));
  }

  return true;
}
