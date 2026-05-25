export type PlanTier = "free" | "pro" | "elite";

export interface PlanConfig {
  id: PlanTier;
  name: string;
  priceMonthlyUsd: number;
  priceMonthlyInr: number;
  priceYearlyUsd: number;
  priceYearlyInr: number;
  applicationsPerDay: number | null;
  modes: ("manual" | "assisted" | "auto")[];
  maxSavedSearches: number | null;
  aiResumeTailoringPerDay: number;
  aiCoverLettersPerDay: number;
  semanticSearch: boolean;
  priorityBrowserWorkers: boolean;
  interviewPrep: boolean;
  atsScoreChecker: boolean;
  resumeTranslator: boolean;
  emailFollowUp: boolean;
  dedicatedSupport: boolean;
  features: string[];
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthlyUsd: 0,
    priceMonthlyInr: 0,
    priceYearlyUsd: 0,
    priceYearlyInr: 0,
    applicationsPerDay: 10,
    modes: ["manual"],
    maxSavedSearches: 3,
    aiResumeTailoringPerDay: 0,
    aiCoverLettersPerDay: 0,
    semanticSearch: false,
    priorityBrowserWorkers: false,
    interviewPrep: false,
    atsScoreChecker: false,
    resumeTranslator: false,
    emailFollowUp: false,
    dedicatedSupport: false,
    features: [
      "10 applications/day",
      "Manual mode only",
      "3 saved job searches",
      "Basic dashboard",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthlyUsd: 12,
    priceMonthlyInr: 999,
    priceYearlyUsd: 120,
    priceYearlyInr: 9990,
    applicationsPerDay: 50,
    modes: ["manual", "assisted", "auto"],
    maxSavedSearches: null,
    aiResumeTailoringPerDay: 5,
    aiCoverLettersPerDay: 5,
    semanticSearch: true,
    priorityBrowserWorkers: false,
    interviewPrep: false,
    atsScoreChecker: false,
    resumeTranslator: false,
    emailFollowUp: false,
    dedicatedSupport: false,
    features: [
      "50 applications/day",
      "All 3 modes (manual/assisted/auto)",
      "Unlimited job searches",
      "AI resume tailoring (5/day)",
      "AI cover letter generation (5/day)",
      "Semantic job matching",
    ],
  },
  elite: {
    id: "elite",
    name: "Elite",
    priceMonthlyUsd: 29,
    priceMonthlyInr: 2499,
    priceYearlyUsd: 290,
    priceYearlyInr: 24990,
    applicationsPerDay: null,
    modes: ["manual", "assisted", "auto"],
    maxSavedSearches: null,
    aiResumeTailoringPerDay: 50,
    aiCoverLettersPerDay: 50,
    semanticSearch: true,
    priorityBrowserWorkers: true,
    interviewPrep: true,
    atsScoreChecker: true,
    resumeTranslator: true,
    emailFollowUp: true,
    dedicatedSupport: true,
    features: [
      "Unlimited applications",
      "All Pro features",
      "Priority browser workers",
      "Interview prep hub",
      "ATS score checker",
      "Resume translator",
      "Email follow-up agent",
      "Dedicated support",
    ],
  },
};

export function getPlanConfig(tier: PlanTier): PlanConfig {
  return PLANS[tier];
}

export function getApplicationsLimit(tier: PlanTier): number | null {
  return PLANS[tier].applicationsPerDay;
}
