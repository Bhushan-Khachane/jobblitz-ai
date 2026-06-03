CREATE TYPE "public"."application_mode" AS ENUM('manual', 'assisted', 'auto');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'submitted', 'failed', 'interview', 'rejected', 'accepted', 'withdrawn', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."coach_queue_status" AS ENUM('open', 'assigned', 'resolved', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('discovered', 'scored', 'approved', 'applied', 'failed', 'skipped', 'expired');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'starter', 'pro', 'unlimited');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_name" varchar(100) NOT NULL,
	"user_id" uuid,
	"input_json" jsonb,
	"state_json" jsonb,
	"output_json" jsonb,
	"status" varchar(50) DEFAULT 'running' NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "application_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"plan_id" uuid,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_step_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"step_name" varchar(255) NOT NULL,
	"tool_name" varchar(100) NOT NULL,
	"tool_args" jsonb,
	"tool_output" jsonb,
	"success" boolean NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"planned_action" jsonb,
	"error_message" text,
	"screenshot_url" text,
	"diff_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"resume_id" uuid,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"approval_status" "approval_status",
	"idempotency_key" varchar(255),
	"cover_letter_id" uuid,
	"tailored_resume_path" text,
	"answers_used" jsonb,
	"error_message" text,
	"screenshot_path" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"applied_at" timestamp with time zone,
	"follow_up_email_sent_at" timestamp with time zone,
	"follow_up_status" varchar(20) DEFAULT 'none',
	"follow_up_count" integer DEFAULT 0 NOT NULL,
	"last_contact_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"application_id" uuid,
	"run_id" uuid,
	"fit_score" integer,
	"reason" text NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"run_id" uuid,
	"artifact_type" varchar(50) NOT NULL,
	"file_key" text NOT NULL,
	"mime_type" varchar(100),
	"size_bytes" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"actor" varchar(50) NOT NULL,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" uuid,
	"details" jsonb,
	"ip_address" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "browser_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"portal" varchar(50) NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending_login' NOT NULL,
	"login_method" varchar(20),
	"verified" boolean DEFAULT false NOT NULL,
	"cookies_path" text,
	"last_verified_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"evidence_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "browser_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "coach_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"priority" integer DEFAULT 3 NOT NULL,
	"trigger_reason" text NOT NULL,
	"assigned_to" varchar(255),
	"status" "coach_queue_status" DEFAULT 'open' NOT NULL,
	"sla_deadline" timestamp with time zone,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"outbound_text" text NOT NULL,
	"blocked" boolean NOT NULL,
	"violations" jsonb,
	"modified_text" text,
	"channel" varchar(50) DEFAULT 'whatsapp' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"engine" varchar(50) NOT NULL,
	"model" varchar(100) NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"cost_usd" integer,
	"latency_ms" integer,
	"job_id" varchar(255),
	"queue_name" varchar(100),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cover_letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"content" text NOT NULL,
	"model_used" varchar(100),
	"prompt_version" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" varchar(50) NOT NULL,
	"username" varchar(255) NOT NULL,
	"encrypted_password" text NOT NULL,
	"session_cookies" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dead_letter_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_name" varchar(200) NOT NULL,
	"task_args" jsonb,
	"error_message" text NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employer_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"note" text NOT NULL,
	"sentiment" varchar(20),
	"source" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"website" text,
	"size" varchar(50),
	"industry" varchar(100),
	"description" text,
	"culture" text,
	"tech_stack" jsonb,
	"reputation_score" integer,
	"research_artifacts" jsonb,
	"last_researched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"followup_type" varchar(50) NOT NULL,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"content" text,
	"subject" varchar(255),
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_name" varchar(100) NOT NULL,
	"job_id" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"payload" jsonb,
	"result" jsonb,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"embedded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"platform" varchar(50) NOT NULL,
	"keywords" varchar(500) NOT NULL,
	"location" varchar(255),
	"experience_level" varchar(50),
	"job_type" varchar(50),
	"remote_only" boolean DEFAULT false NOT NULL,
	"salary_min_lpa" integer,
	"salary_max_lpa" integer,
	"extra_filters" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"auto_match" boolean DEFAULT false NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(255),
	"base_url" text,
	"api_key" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_sources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_search_id" uuid,
	"user_id" uuid NOT NULL,
	"source_id" uuid,
	"platform" varchar(50) NOT NULL,
	"external_job_id" varchar(255),
	"title" varchar(500) NOT NULL,
	"company" varchar(255) NOT NULL,
	"employer_id" uuid,
	"location" varchar(255),
	"description" text,
	"requirements" jsonb,
	"responsibilities" jsonb,
	"skills_required" jsonb,
	"experience_level" varchar(50),
	"years_experience_min" integer,
	"years_experience_max" integer,
	"salary_min_lpa" integer,
	"salary_max_lpa" integer,
	"job_type" varchar(50),
	"remote_policy" varchar(50),
	"apply_url" text,
	"salary_info" varchar(255),
	"posted_date" varchar(100),
	"status" "job_status" DEFAULT 'discovered' NOT NULL,
	"match_score" integer,
	"match_explanation" jsonb,
	"extra_data" jsonb,
	"normalized_hash" varchar(64),
	"raw_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"digest_frequency" varchar(20) DEFAULT 'daily' NOT NULL,
	"follow_up_enabled" boolean DEFAULT true NOT NULL,
	"application_updates" boolean DEFAULT true NOT NULL,
	"marketing" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "orchestration_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"graph_state" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'running' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "portal_inbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"portal" varchar(50) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"job_title" varchar(500),
	"company" varchar(255),
	"event_data" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"occurred_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"headline" varchar(500),
	"summary" text,
	"skills" jsonb,
	"experience" jsonb,
	"education" jsonb,
	"certifications" jsonb,
	"preferred_job_titles" jsonb,
	"preferred_locations" jsonb,
	"expected_salary_lpa" integer,
	"salary_min_lpa" integer,
	"salary_max_lpa" integer,
	"experience_years" integer,
	"experience_level" varchar(50),
	"remote_only" boolean DEFAULT false NOT NULL,
	"target_portals" jsonb,
	"notice_period_days" integer,
	"current_ctc_lpa" integer,
	"current_fixed_lpa" integer,
	"current_variable_lpa" integer,
	"languages" jsonb,
	"job_type" varchar(50),
	"work_mode" varchar(50),
	"portfolio_url" varchar(500),
	"linkedin_url" varchar(500),
	"github_url" varchar(500),
	"ai_summary" text,
	"ai_summary_updated_at" timestamp with time zone,
	"parsed_profile" jsonb,
	"profile_parsed_at" timestamp with time zone,
	"onboarding_step" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"answer_text" text NOT NULL,
	"platform" varchar(50),
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"file_key" text,
	"parsed_text" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "tailored_resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"resume_id" uuid,
	"content" text NOT NULL,
	"model_used" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_skill_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"skill_text" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"hashed_password" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"phone" varchar(20),
	"location" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"application_mode" "application_mode" DEFAULT 'assisted' NOT NULL,
	"daily_apply_limit" integer DEFAULT 50 NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_runs" ADD CONSTRAINT "application_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_runs" ADD CONSTRAINT "application_runs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_step_events" ADD CONSTRAINT "application_step_events_run_id_application_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."application_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_cover_letter_id_cover_letters_id_fk" FOREIGN KEY ("cover_letter_id") REFERENCES "public"."cover_letters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_run_id_application_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."application_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_run_id_application_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."application_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_sessions" ADD CONSTRAINT "browser_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_queue" ADD CONSTRAINT "coach_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_queue" ADD CONSTRAINT "coach_queue_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_log" ADD CONSTRAINT "compliance_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_log" ADD CONSTRAINT "cost_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_notes" ADD CONSTRAINT "employer_notes_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_notes" ADD CONSTRAINT "employer_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followups" ADD CONSTRAINT "followups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followups" ADD CONSTRAINT "followups_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_embeddings" ADD CONSTRAINT "job_embeddings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_searches" ADD CONSTRAINT "job_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_job_search_id_job_searches_id_fk" FOREIGN KEY ("job_search_id") REFERENCES "public"."job_searches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_id_job_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orchestration_checkpoints" ADD CONSTRAINT "orchestration_checkpoints_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orchestration_checkpoints" ADD CONSTRAINT "orchestration_checkpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_inbox_events" ADD CONSTRAINT "portal_inbox_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tailored_resumes" ADD CONSTRAINT "tailored_resumes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tailored_resumes" ADD CONSTRAINT "tailored_resumes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tailored_resumes" ADD CONSTRAINT "tailored_resumes_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skill_embeddings" ADD CONSTRAINT "user_skill_embeddings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_agent_runs_user_id" ON "agent_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_agent_runs_agent_name" ON "agent_runs" USING btree ("agent_name");--> statement-breakpoint
CREATE INDEX "ix_application_runs_user_status" ON "application_runs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "ix_application_runs_job" ON "application_runs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "ix_step_events_run_id" ON "application_step_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ix_step_events_success" ON "application_step_events" USING btree ("success");--> statement-breakpoint
CREATE INDEX "ix_applications_user_status" ON "applications" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "ix_approvals_user_status" ON "approvals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "ix_audit_events_user_id" ON "audit_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_audit_events_actor" ON "audit_events" USING btree ("actor");--> statement-breakpoint
CREATE INDEX "ix_audit_events_created_at" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ix_browser_sessions_user_portal" ON "browser_sessions" USING btree ("user_id","portal");--> statement-breakpoint
CREATE INDEX "ix_coach_queue_user_status" ON "coach_queue" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "ix_coach_queue_priority" ON "coach_queue" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "ix_coach_queue_sla" ON "coach_queue" USING btree ("sla_deadline");--> statement-breakpoint
CREATE INDEX "ix_compliance_log_user" ON "compliance_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_cost_log_user" ON "cost_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_cost_log_engine" ON "cost_log" USING btree ("engine","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_credentials_user_platform" ON "credentials" USING btree ("user_id","platform");--> statement-breakpoint
CREATE INDEX "ix_embeddings_entity" ON "embeddings" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ix_embeddings_vector" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "ix_employers_name" ON "employers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "ix_job_audit_log_queue" ON "job_audit_log" USING btree ("queue_name","created_at");--> statement-breakpoint
CREATE INDEX "ix_job_audit_log_status" ON "job_audit_log" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "ix_job_embeddings_job" ON "job_embeddings" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "ix_job_embeddings_vector" ON "job_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "ix_job_searches_user_active" ON "job_searches" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "ix_jobs_user_status" ON "jobs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "ix_jobs_platform_extid" ON "jobs" USING btree ("platform","external_job_id");--> statement-breakpoint
CREATE INDEX "ix_jobs_user_score" ON "jobs" USING btree ("user_id","match_score");--> statement-breakpoint
CREATE INDEX "ix_notification_prefs_user" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_checkpoints_app" ON "orchestration_checkpoints" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "ix_checkpoints_user_status" ON "orchestration_checkpoints" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "ix_checkpoints_expires" ON "orchestration_checkpoints" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ix_portal_inbox_events_user_portal" ON "portal_inbox_events" USING btree ("user_id","portal");--> statement-breakpoint
CREATE INDEX "ix_portal_inbox_events_read" ON "portal_inbox_events" USING btree ("read");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_question_answers_user_question_platform" ON "question_answers" USING btree ("user_id","question_text","platform");--> statement-breakpoint
CREATE INDEX "ix_usage_logs_user_action" ON "usage_logs" USING btree ("user_id","action");--> statement-breakpoint
CREATE INDEX "ix_user_skill_embeddings_user" ON "user_skill_embeddings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_user_skill_embeddings_vector" ON "user_skill_embeddings" USING hnsw ("embedding" vector_cosine_ops);