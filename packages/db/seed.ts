import { createDatabaseClient, schema } from "./src";

async function main() {
  const db = createDatabaseClient(process.env.DATABASE_URL!);

  console.log("Seeding plans...");

  const [freePlan] = await db.insert(schema.plans).values({
    name: "free",
    dailyApplyCap: 3,
    monthlyApplyQuota: 60,
    portalAccess: ["linkedin"],
    whatsappEnabled: false,
    coachEnabled: false,
    priceInr: 0,
  }).returning();

  if (!freePlan) throw new Error("Failed to seed free plan");
  console.log("Seeded free plan:", freePlan.id);

  const [starterPlan] = await db.insert(schema.plans).values({
    name: "starter",
    dailyApplyCap: 10,
    monthlyApplyQuota: 300,
    portalAccess: ["linkedin", "indeed"],
    whatsappEnabled: true,
    coachEnabled: false,
    priceInr: 499,
  }).returning();

  if (!starterPlan) throw new Error("Failed to seed starter plan");
  console.log("Seeded starter plan:", starterPlan.id);

  const [proPlan] = await db.insert(schema.plans).values({
    name: "pro",
    dailyApplyCap: 25,
    monthlyApplyQuota: 750,
    portalAccess: ["linkedin", "indeed", "naukri", "wellfound"],
    whatsappEnabled: true,
    coachEnabled: true,
    priceInr: 999,
  }).returning();

  if (!proPlan) throw new Error("Failed to seed pro plan");
  console.log("Seeded pro plan:", proPlan.id);

  console.log("Seeding test user...");

  const [user] = await db.insert(schema.users).values({
    email: "test@example.com",
    hashedPassword: "hashed_password", // In real world, use a proper hash
    fullName: "Test User",
    phone: "919999999999",
    plan: "starter",
  }).returning();

  if (user && starterPlan) {
    await db.insert(schema.subscriptions).values({
      userId: user.id,
      planId: starterPlan.id,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  }

  console.log("Seed complete!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
