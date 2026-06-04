CREATE TYPE "public"."application_mode" AS ENUM('manual', 'assisted', 'auto');
CREATE TYPE "public"."job_status" AS ENUM('discovered', 'scored', 'approved', 'applied', 'failed', 'skipped', 'expired');
CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'submitted', 'failed', 'interview', 'rejected', 'accepted', 'withdrawn', 'skipped', 'quota_exceeded', 'portal_not_in_plan', 'score_below_threshold');
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'expired');
CREATE TYPE "public"."plan" AS ENUM('free', 'starter', 'pro', 'unlimited');
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'cancelled');
CREATE TABLE IF NOT EXISTS "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"daily_apply_cap" integer NOT NULL,
	"monthly_apply_quota" integer NOT NULL,
	"portal_access" text[] NOT NULL,
	"whatsapp_enabled" boolean DEFAULT false NOT NULL,
	"coach_enabled" boolean DEFAULT false NOT NULL,
	"price_inr" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "usage_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"applies_count" integer DEFAULT 0 NOT NULL,
	"discoveries_count" integer DEFAULT 0 NOT NULL
);
CREATE TABLE IF NOT EXISTS "interview_callbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid,
	"user_id" uuid NOT NULL,
	"source" varchar(50) NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "subscriptions" RENAME COLUMN "stripe_customer_id" TO "razorpay_subscription_id";
ALTER TABLE "subscriptions" ALTER COLUMN "razorpay_subscription_id" SET DATA TYPE varchar(255);
ALTER TABLE "subscriptions" DROP COLUMN "stripe_subscription_id";
ALTER TABLE "subscriptions" DROP COLUMN "plan";
ALTER TABLE "subscriptions" ADD COLUMN "plan_id" uuid;
ALTER TABLE "subscriptions" ADD COLUMN "current_period_start" timestamp with time zone;
ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'active';

ALTER TABLE "approvals" ADD COLUMN "whatsapp_message_id" varchar(255);

DO $$ BEGIN
 ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 ALTER TABLE "interview_callbacks" ADD CONSTRAINT "interview_callbacks_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 ALTER TABLE "interview_callbacks" ADD CONSTRAINT "interview_callbacks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_usage_counters_user_date" ON "usage_counters" USING btree ("user_id","date");

ALTER TABLE "applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resumes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications_owner_policy" ON "applications" FOR ALL TO public USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "jobs_owner_policy" ON "jobs" FOR ALL TO public USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "resumes_owner_policy" ON "resumes" FOR ALL TO public USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
