import type { Job, Profile, Application, Employer } from "@jobblitz/types";

export interface JobBlitzState {
  userId: string;
  jobId?: string | undefined;
  applicationId?: string | undefined;
  employerId?: string | undefined;
  job?: Job | undefined;
  profile?: Profile | undefined;
  application?: Application | undefined;
  employer?: Employer | undefined;
  score?: number | undefined;
  decision?: "auto" | "approve" | "skip" | undefined;
  error?: string | undefined;
  step?: string | undefined;
  artifacts?: Record<string, unknown> | undefined;
}

export interface IngestionState extends JobBlitzState {
  rawJobs: unknown[];
  normalizedJobs: Job[];
}

export interface ScoringState extends JobBlitzState {
  dimensions?: Record<string, unknown> | undefined;
}

export interface ApplicationState extends JobBlitzState {
  jobUrl?: string | undefined;
  atsType?: "greenhouse" | "lever" | "ashby" | "workday" | "naukri" | "linkedin" | "unknown" | undefined;
  applyUrl?: string | undefined;
  resumePath?: string | undefined;
  coverLetter?: string | undefined;
  payload?: ApplyPayload | undefined;
  confirmationId?: string | undefined;
  screenshotPath?: string | undefined;
  browserResult?: { success: boolean; confirmationId?: string; screenshot?: string; error?: string } | undefined;
  step?: "init" | "detect_ats" | "apply" | "verify" | "notify" | "failed" | "completed" | undefined;
  retryCount?: number | undefined;
  humanApprovalRequired?: boolean | undefined;
  approvedAt?: string | undefined;
}

export interface ApplyPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  resumePath?: string;
  coverLetter?: string;
  linkedin?: string;
  portfolio?: string;
  answers?: Record<string, string>;
}

export interface FollowUpState extends JobBlitzState {
  followupType?: string | undefined;
  scheduledFor?: string | undefined;
  content?: string | undefined;
}

// === ParserAgent types ===
export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: string[];
  education: string[];
  summary: string;
  parsingConfidence: number;
}

// === HunterAgent types ===
export interface JobListing {
  id: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  url?: string;
  postedAt?: string;
  source: string;
}

export interface HunterInput {
  keywords: string;
  location?: string | undefined;
  experienceLevel?: string | undefined;
}

export interface HunterOutput {
  jobs: JobListing[];
  cached: boolean;
  quotaExhausted: boolean;
}

export interface JobProviderAdapter {
  search(input: HunterInput): Promise<JobListing[]>;
}

// === MatchScorerAgent types ===
export interface MatchInput {
  jobText: string;
  resumeText: string;
  profile?: Profile;
}

export interface MatchResult {
  score: number;
  analysis: string;
  strengths: string[];
  gaps: string[];
  confidence: number;
}

// === GapAnalyzerAgent types ===
export interface GapInput {
  jobSkills: string[];
  profileSkills: string[];
  jobExperience?: string;
  profileExperience?: string;
}

export interface GapOutput {
  missingSkills: string[];
  transferableSkills: string[];
  experienceGaps: string[];
  upgradePath: string[];
}

// === RedFlagAgent types ===
export interface RedFlagResult {
  overallRisk: "SAFE" | "CAUTION" | "HIGH";
  flags: string[];
  askCoach: boolean;
}

// === ATSRewriteAgent types ===
export interface ATSRewriteInput {
  resumeText: string;
  jobDescription: string;
}

export interface ATSRewriteOutput {
  markdown: string;
  changeLog: string[];
  confidence: number;
  antiFabricationCheck: boolean;
}

// === CoverLetterAgent types ===
export interface CoverLetterInput {
  profile: Profile;
  job: Job;
  tone?: "formal" | "friendly" | "assertive";
}

export interface CoverLetterOutput {
  coverLetter: string;
  confidence: number;
}

// === CompanyResearchAgent types ===
export interface CompanyResearch {
  brief: string;
  news: string[];
  culture: string;
  interviewThemes: string[];
  glassdoorRating?: number | undefined;
}

// === CoachPrepAgent types ===
export interface CoachPrepInput {
  companyName: string;
  jobTitle: string;
  profile: Profile;
}

export interface CoachPrepOutput {
  companyBrief: string;
  likelyQuestions: string[];
  salaryPositioning: string;
  smartQuestions: string[];
  redFlags: string[];
}

// === SalaryBenchmarkAgent types ===
export interface SalaryInput {
  role: string;
  location?: string | undefined;
  experienceYears?: number | undefined;
}

export interface SalaryBenchmark {
  marketRange: {
    min: number;
    max: number;
    median: number;
    currency: string;
  };
  source: string;
  confidence: number;
  negotiationTip: string;
}

// === ComplianceAgent types ===
export interface ComplianceResult {
  blocked: boolean;
  violations: string[];
  reason: string;
  modifiedText?: string | undefined;
}

// === SentimentAgent types ===
export interface SentimentResult {
  sentiment: string;
  intent: string;
  urgency: number;
  humanHandoffNeeded: boolean;
  churnRisk: number;
  replyStrategy: string;
}
