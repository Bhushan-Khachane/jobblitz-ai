import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

export const applicationModeEnum = pgEnum("application_mode", [
  "manual",
  "assisted",
  "auto",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "discovered",
  "scored",
  "approved",
  "applied",
  "failed",
  "skipped",
  "expired",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "approved",
  "submitted",
  "failed",
  "interview",
  "rejected",
  "accepted",
  "withdrawn",
  "skipped",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
]);

export const planEnum = pgEnum("plan", ["free", "starter", "pro", "unlimited"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  hashedPassword: varchar("hashed_password", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  location: varchar("location", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  applicationMode: applicationModeEnum("application_mode").default("assisted").notNull(),
  dailyApplyLimit: integer("daily_apply_limit").default(50).notNull(),
  plan: planEnum("plan").default("free").notNull(),
  role: varchar("role", { length: 20 }).default("user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  headline: varchar("headline", { length: 500 }),
  summary: text("summary"),
  skills: jsonb("skills").$type<string[]>(),
  experience: jsonb("experience"),
  education: jsonb("education"),
  certifications: jsonb("certifications"),
  preferredJobTitles: jsonb("preferred_job_titles").$type<string[]>(),
  preferredLocations: jsonb("preferred_locations").$type<string[]>(),
  expectedSalaryLpa: integer("expected_salary_lpa"),
  salaryMinLpa: integer("salary_min_lpa"),
  salaryMaxLpa: integer("salary_max_lpa"),
  experienceYears: integer("experience_years"),
  experienceLevel: varchar("experience_level", { length: 50 }),
  remoteOnly: boolean("remote_only").default(false).notNull(),
  targetPortals: jsonb("target_portals").$type<string[]>(),
  noticePeriodDays: integer("notice_period_days"),
  currentCtcLpa: integer("current_ctc_lpa"),
  currentFixedLpa: integer("current_fixed_lpa"),
  currentVariableLpa: integer("current_variable_lpa"),
  languages: jsonb("languages").$type<string[]>(),
  jobType: varchar("job_type", { length: 50 }),
  workMode: varchar("work_mode", { length: 50 }),
  portfolioUrl: varchar("portfolio_url", { length: 500 }),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  githubUrl: varchar("github_url", { length: 500 }),
  aiSummary: text("ai_summary"),
  aiSummaryUpdatedAt: timestamp("ai_summary_updated_at", { withTimezone: true }),
  parsedProfile: jsonb("parsed_profile"),
  profileParsedAt: timestamp("profile_parsed_at", { withTimezone: true }),
  onboardingStep: integer("onboarding_step").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const credentials = pgTable(
  "credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 50 }).notNull(),
    username: varchar("username", { length: 255 }).notNull(),
    encryptedPassword: text("encrypted_password").notNull(),
    sessionCookies: text("session_cookies"),
    isActive: boolean("is_active").default(true).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ix_credentials_user_platform").on(table.userId, table.platform),
  ]
);

export const resumes = pgTable("resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  filePath: text("file_path").notNull(),
  fileKey: text("file_key"),
  parsedText: text("parsed_text"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tailoredResumes = pgTable("tailored_resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  resumeId: uuid("resume_id").references(() => resumes.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  modelUsed: varchar("model_used", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const coverLetters = pgTable("cover_letters", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  modelUsed: varchar("model_used", { length: 100 }),
  promptVersion: varchar("prompt_version", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobSearches = pgTable(
  "job_searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    platform: varchar("platform", { length: 50 }).notNull(),
    keywords: varchar("keywords", { length: 500 }).notNull(),
    location: varchar("location", { length: 255 }),
    experienceLevel: varchar("experience_level", { length: 50 }),
    jobType: varchar("job_type", { length: 50 }),
    remoteOnly: boolean("remote_only").default(false).notNull(),
    salaryMinLpa: integer("salary_min_lpa"),
    salaryMaxLpa: integer("salary_max_lpa"),
    extraFilters: jsonb("extra_filters"),
    isActive: boolean("is_active").default(true).notNull(),
    autoMatch: boolean("auto_match").default(false).notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("ix_job_searches_user_active").on(table.userId, table.isActive)]
);

export const jobSources = pgTable("job_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }),
  baseUrl: text("base_url"),
  apiKey: text("api_key"),
  isActive: boolean("is_active").default(true).notNull(),
  config: jsonb("config"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobSearchId: uuid("job_search_id").references(() => jobSearches.id, { onDelete: "set null" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").references(() => jobSources.id, { onDelete: "set null" }),
    platform: varchar("platform", { length: 50 }).notNull(),
    externalJobId: varchar("external_job_id", { length: 255 }),
    title: varchar("title", { length: 500 }).notNull(),
    company: varchar("company", { length: 255 }).notNull(),
    employerId: uuid("employer_id").references(() => employers.id, { onDelete: "set null" }),
    location: varchar("location", { length: 255 }),
    description: text("description"),
    requirements: jsonb("requirements").$type<string[]>(),
    responsibilities: jsonb("responsibilities").$type<string[]>(),
    skillsRequired: jsonb("skills_required").$type<string[]>(),
    experienceLevel: varchar("experience_level", { length: 50 }),
    yearsExperienceMin: integer("years_experience_min"),
    yearsExperienceMax: integer("years_experience_max"),
    salaryMinLpa: integer("salary_min_lpa"),
    salaryMaxLpa: integer("salary_max_lpa"),
    jobType: varchar("job_type", { length: 50 }),
    remotePolicy: varchar("remote_policy", { length: 50 }),
    applyUrl: text("apply_url"),
    salaryInfo: varchar("salary_info", { length: 255 }),
    postedDate: varchar("posted_date", { length: 100 }),
    status: jobStatusEnum("status").default("discovered").notNull(),
    matchScore: integer("match_score"),
    matchExplanation: jsonb("match_explanation"),
    extraData: jsonb("extra_data"),
    normalizedHash: varchar("normalized_hash", { length: 64 }),
    rawData: jsonb("raw_data"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ix_jobs_user_status").on(table.userId, table.status),
    index("ix_jobs_platform_extid").on(table.platform, table.externalJobId),
    index("ix_jobs_user_score").on(table.userId, table.matchScore),
  ]
);

export const employers = pgTable(
  "employers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    website: text("website"),
    size: varchar("size", { length: 50 }),
    industry: varchar("industry", { length: 100 }),
    description: text("description"),
    culture: text("culture"),
    techStack: jsonb("tech_stack").$type<string[]>(),
    reputationScore: integer("reputation_score"),
    researchArtifacts: jsonb("research_artifacts"),
    lastResearchedAt: timestamp("last_researched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("ix_employers_name").on(table.name)]
);

export const employerNotes = pgTable("employer_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  employerId: uuid("employer_id")
    .notNull()
    .references(() => employers.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  sentiment: varchar("sentiment", { length: 20 }),
  source: varchar("source", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    resumeId: uuid("resume_id").references(() => resumes.id, { onDelete: "set null" }),
    status: applicationStatusEnum("status").default("pending").notNull(),
    approvalStatus: approvalStatusEnum("approval_status"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).unique(),
    coverLetterId: uuid("cover_letter_id").references(() => coverLetters.id, { onDelete: "set null" }),
    tailoredResumePath: text("tailored_resume_path"),
    answersUsed: jsonb("answers_used"),
    errorMessage: text("error_message"),
    screenshotPath: text("screenshot_path"),
    retryCount: integer("retry_count").default(0).notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    followUpEmailSentAt: timestamp("follow_up_email_sent_at", { withTimezone: true }),
    followUpStatus: varchar("follow_up_status", { length: 20 }).default("none"),
    followUpCount: integer("follow_up_count").default(0).notNull(),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("ix_applications_user_status").on(table.userId, table.status)]
);

export const applicationRuns = pgTable(
  "application_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    planId: uuid("plan_id"),
    status: varchar("status", { length: 20 }).default("queued").notNull(),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ix_application_runs_user_status").on(table.userId, table.status),
    index("ix_application_runs_job").on(table.jobId),
  ]
);

export const applicationStepEvents = pgTable(
  "application_step_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => applicationRuns.id, { onDelete: "cascade" }),
    stepName: varchar("step_name", { length: 255 }).notNull(),
    toolName: varchar("tool_name", { length: 100 }).notNull(),
    toolArgs: jsonb("tool_args"),
    toolOutput: jsonb("tool_output"),
    success: boolean("success").notNull(),
    dryRun: boolean("dry_run").default(false).notNull(),
    plannedAction: jsonb("planned_action"),
    errorMessage: text("error_message"),
    screenshotUrl: text("screenshot_url"),
    diffText: text("diff_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ix_step_events_run_id").on(table.runId),
    index("ix_step_events_success").on(table.success),
  ]
);

export const followups = pgTable("followups", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  followupType: varchar("followup_type", { length: 50 }).notNull(),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  content: text("content"),
  subject: varchar("subject", { length: 255 }),
  status: varchar("status", { length: 20 }).default("scheduled").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  runId: uuid("run_id").references(() => applicationRuns.id, { onDelete: "set null" }),
  artifactType: varchar("artifact_type", { length: 50 }).notNull(),
  fileKey: text("file_key").notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  sizeBytes: integer("size_bytes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentName: varchar("agent_name", { length: 100 }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    inputJson: jsonb("input_json"),
    stateJson: jsonb("state_json"),
    outputJson: jsonb("output_json"),
    status: varchar("status", { length: 50 }).default("running").notNull(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("ix_agent_runs_user_id").on(table.userId),
    index("ix_agent_runs_agent_name").on(table.agentName),
  ]
);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
    runId: uuid("run_id").references(() => applicationRuns.id, { onDelete: "set null" }),
    fitScore: integer("fit_score"),
    reason: text("reason").notNull(),
    status: approvalStatusEnum("status").default("pending").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("ix_approvals_user_status").on(table.userId, table.status)]
);

export const questionAnswers = pgTable(
  "question_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionText: text("question_text").notNull(),
    answerText: text("answer_text").notNull(),
    platform: varchar("platform", { length: 50 }),
    usageCount: integer("usage_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_question_answers_user_question_platform").on(
      table.userId,
      table.questionText,
      table.platform
    ),
  ]
);

export const usageLogs = pgTable(
  "usage_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 100 }).notNull(),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("ix_usage_logs_user_action").on(table.userId, table.action)]
);

export const deadLetterLogs = pgTable("dead_letter_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskName: varchar("task_name", { length: 200 }).notNull(),
  taskArgs: jsonb("task_args"),
  errorMessage: text("error_message").notNull(),
  retryCount: integer("retry_count").default(0).notNull(),
  resolved: boolean("resolved").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const portalInboxEvents = pgTable(
  "portal_inbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    portal: varchar("portal", { length: 50 }).notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    jobTitle: varchar("job_title", { length: 500 }),
    company: varchar("company", { length: 255 }),
    eventData: jsonb("event_data"),
    read: boolean("read").default(false).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ix_portal_inbox_events_user_portal").on(table.userId, table.portal),
    index("ix_portal_inbox_events_read").on(table.read),
  ]
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    actor: varchar("actor", { length: 50 }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    resourceType: varchar("resource_type", { length: 100 }).notNull(),
    resourceId: uuid("resource_id"),
    details: jsonb("details"),
    ipAddress: varchar("ip_address", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ix_audit_events_user_id").on(table.userId),
    index("ix_audit_events_actor").on(table.actor),
    index("ix_audit_events_created_at").on(table.createdAt),
  ]
);

export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ix_embeddings_entity").on(table.entityType, table.entityId),
    index("ix_embeddings_vector").using("hnsw", table.embedding.op("vector_cosine_ops")),
  ]
);

export const jobEmbeddings = pgTable(
  "job_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    embeddedAt: timestamp("embedded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ix_job_embeddings_job").on(table.jobId),
    index("ix_job_embeddings_vector").using("hnsw", table.embedding.op("vector_cosine_ops")),
  ]
);

export const userSkillEmbeddings = pgTable(
  "user_skill_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillText: text("skill_text").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ix_user_skill_embeddings_user").on(table.userId),
    index("ix_user_skill_embeddings_vector").using("hnsw", table.embedding.op("vector_cosine_ops")),
  ]
);

export const browserSessions = pgTable(
  "browser_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    portal: varchar("portal", { length: 50 }).notNull(),
    sessionId: varchar("session_id", { length: 255 }).notNull().unique(),
    status: varchar("status", { length: 20 }).default("pending_login").notNull(),
    loginMethod: varchar("login_method", { length: 20 }),
    verified: boolean("verified").default(false).notNull(),
    cookiesPath: text("cookies_path"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    evidenceJson: jsonb("evidence_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("ix_browser_sessions_user_portal").on(table.userId, table.portal)]
);

export const orchestrationCheckpoints = pgTable(
  "orchestration_checkpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    graphState: jsonb("graph_state").notNull(),
    status: varchar("status", { length: 50 }).default("running").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    index("ix_checkpoints_app").on(table.applicationId),
    index("ix_checkpoints_user_status").on(table.userId, table.status),
    index("ix_checkpoints_expires").on(table.expiresAt),
  ]
);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  plan: planEnum("plan").default("free").notNull(),
  status: subscriptionStatusEnum("status").default("active").notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    emailNotifications: boolean("email_notifications").default(true).notNull(),
    digestFrequency: varchar("digest_frequency", { length: 20 }).default("daily").notNull(),
    followUpEnabled: boolean("follow_up_enabled").default(true).notNull(),
    applicationUpdates: boolean("application_updates").default(true).notNull(),
    marketing: boolean("marketing").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("ix_notification_prefs_user").on(table.userId)]
);

// ── Assisted Apply Engine Tables ───────────────────────────────────────────────

export const coachQueueStatusEnum = pgEnum("coach_queue_status", [
  "open",
  "assigned",
  "resolved",
  "escalated",
]);

export const coachQueue = pgTable(
  "coach_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
    priority: integer("priority").default(3).notNull(),
    triggerReason: text("trigger_reason").notNull(),
    assignedTo: varchar("assigned_to", { length: 255 }),
    status: coachQueueStatusEnum("status").default("open").notNull(),
    slaDeadline: timestamp("sla_deadline", { withTimezone: true }),
    resolutionNotes: text("resolution_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ix_coach_queue_user_status").on(table.userId, table.status),
    index("ix_coach_queue_priority").on(table.status, table.priority),
    index("ix_coach_queue_sla").on(table.slaDeadline),
  ]
);

export const complianceLog = pgTable(
  "compliance_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    outboundText: text("outbound_text").notNull(),
    blocked: boolean("blocked").notNull(),
    violations: jsonb("violations").$type<string[]>(),
    modifiedText: text("modified_text"),
    channel: varchar("channel", { length: 50 }).default("whatsapp").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("ix_compliance_log_user").on(table.userId, table.createdAt)]
);

export const costLog = pgTable(
  "cost_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    engine: varchar("engine", { length: 50 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    costUsd: integer("cost_usd"), // stored as micro-dollars to avoid floats
    latencyMs: integer("latency_ms"),
    jobId: varchar("job_id", { length: 255 }),
    queueName: varchar("queue_name", { length: 100 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ix_cost_log_user").on(table.userId, table.createdAt),
    index("ix_cost_log_engine").on(table.engine, table.createdAt),
  ]
);

export const jobAuditLog = pgTable(
  "job_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queueName: varchar("queue_name", { length: 100 }).notNull(),
    jobId: varchar("job_id", { length: 255 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    payload: jsonb("payload"),
    result: jsonb("result"),
    error: text("error"),
    attempts: integer("attempts").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ix_job_audit_log_queue").on(table.queueName, table.createdAt),
    index("ix_job_audit_log_status").on(table.status, table.createdAt),
  ]
);
