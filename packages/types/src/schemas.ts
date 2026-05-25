import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  phone: z.string().optional(),
  location: z.string().optional(),
  isActive: z.boolean().default(true),
  applicationMode: z.enum(["manual", "assisted", "auto"]).default("assisted"),
  dailyApplyLimit: z.number().int().default(50),
  plan: z.enum(["free", "starter", "pro", "unlimited"]).default("free"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  headline: z.string().optional(),
  summary: z.string().optional(),
  skills: z.array(z.string()).optional(),
  experience: z.record(z.unknown()).optional(),
  education: z.record(z.unknown()).optional(),
  certifications: z.record(z.unknown()).optional(),
  preferredJobTitles: z.array(z.string()).optional(),
  preferredLocations: z.array(z.string()).optional(),
  expectedSalaryLpa: z.number().optional(),
  salaryMinLpa: z.number().optional(),
  salaryMaxLpa: z.number().optional(),
  experienceYears: z.number().optional(),
  experienceLevel: z.string().optional(),
  remoteOnly: z.boolean().default(false),
  targetPortals: z.array(z.string()).optional(),
  noticePeriodDays: z.number().optional(),
  currentCtcLpa: z.number().optional(),
  currentFixedLpa: z.number().optional(),
  currentVariableLpa: z.number().optional(),
  languages: z.array(z.string()).optional(),
  jobType: z.string().optional(),
  workMode: z.string().optional(),
  portfolioUrl: z.string().optional(),
  linkedinUrl: z.string().optional(),
  githubUrl: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const JobSchema = z.object({
  id: z.string().uuid(),
  jobSearchId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  sourceId: z.string().uuid().optional(),
  platform: z.string(),
  externalJobId: z.string().optional(),
  title: z.string(),
  company: z.string(),
  employerId: z.string().uuid().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  skillsRequired: z.array(z.string()).optional(),
  experienceLevel: z.string().optional(),
  yearsExperienceMin: z.number().optional(),
  yearsExperienceMax: z.number().optional(),
  salaryMinLpa: z.number().optional(),
  salaryMaxLpa: z.number().optional(),
  jobType: z.string().optional(),
  remotePolicy: z.string().optional(),
  applyUrl: z.string().optional(),
  salaryInfo: z.string().optional(),
  postedDate: z.string().optional(),
  status: z.enum(["discovered", "scored", "approved", "applied", "failed", "skipped", "expired"]).default("discovered"),
  matchScore: z.number().optional(),
  matchExplanation: z.record(z.unknown()).optional(),
  extraData: z.record(z.unknown()).optional(),
  normalizedHash: z.string().optional(),
  rawData: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
});

export type Job = z.infer<typeof JobSchema>;

export const EmployerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  website: z.string().optional(),
  size: z.string().optional(),
  industry: z.string().optional(),
  description: z.string().optional(),
  culture: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  reputationScore: z.number().optional(),
  researchArtifacts: z.record(z.unknown()).optional(),
  lastResearchedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Employer = z.infer<typeof EmployerSchema>;

export const ApplicationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  jobId: z.string().uuid(),
  resumeId: z.string().uuid().optional(),
  status: z.enum(["pending", "approved", "submitted", "failed", "interview", "rejected", "accepted", "withdrawn", "skipped"]).default("pending"),
  approvalStatus: z.enum(["pending", "approved", "rejected", "expired"]).optional(),
  idempotencyKey: z.string().optional(),
  coverLetterId: z.string().uuid().optional(),
  tailoredResumePath: z.string().optional(),
  answersUsed: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional(),
  screenshotPath: z.string().optional(),
  retryCount: z.number().default(0),
  appliedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Application = z.infer<typeof ApplicationSchema>;

export const ApprovalSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  jobId: z.string().uuid(),
  applicationId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
  fitScore: z.number().optional(),
  reason: z.string(),
  status: z.enum(["pending", "approved", "rejected", "expired"]).default("pending"),
  reviewedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Approval = z.infer<typeof ApprovalSchema>;

export const ArtifactSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  runId: z.string().uuid().optional(),
  artifactType: z.string(),
  fileKey: z.string(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
});

export type Artifact = z.infer<typeof ArtifactSchema>;

export const ResumeSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  filePath: z.string(),
  fileKey: z.string().optional(),
  parsedText: z.string().optional(),
  isDefault: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Resume = z.infer<typeof ResumeSchema>;

export const CoverLetterSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  jobId: z.string().uuid(),
  content: z.string(),
  modelUsed: z.string().optional(),
  promptVersion: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type CoverLetter = z.infer<typeof CoverLetterSchema>;

export const FollowupSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  applicationId: z.string().uuid(),
  followupType: z.string(),
  scheduledFor: z.string().datetime().optional(),
  sentAt: z.string().datetime().optional(),
  content: z.string().optional(),
  subject: z.string().optional(),
  status: z.enum(["scheduled", "sent", "cancelled", "failed"]).default("scheduled"),
  createdAt: z.string().datetime(),
});

export type Followup = z.infer<typeof FollowupSchema>;

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  actor: z.string(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().uuid().optional(),
  details: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const EmbeddingSchema = z.object({
  id: z.string().uuid(),
  entityType: z.string(),
  entityId: z.string().uuid(),
  content: z.string(),
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
});

export type Embedding = z.infer<typeof EmbeddingSchema>;

export const JobSearchSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  platform: z.string(),
  keywords: z.string(),
  location: z.string().optional(),
  experienceLevel: z.string().optional(),
  jobType: z.string().optional(),
  remoteOnly: z.boolean().default(false),
  salaryMinLpa: z.number().optional(),
  salaryMaxLpa: z.number().optional(),
  extraFilters: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
  autoMatch: z.boolean().default(false),
  lastRunAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type JobSearch = z.infer<typeof JobSearchSchema>;
