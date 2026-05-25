export interface SonarQuery {
  query: string;
  model?: "sonar" | "sonar-pro" | "sonar-reasoning";
  maxTokens?: number;
  temperature?: number;
}

export interface SonarCitation {
  url: string;
  title?: string | undefined;
  snippet?: string | undefined;
}

export interface SonarResponse {
  answer: string;
  citations: SonarCitation[];
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
}

export interface EmployerResearchResult {
  name: string;
  website?: string | undefined;
  size?: string | undefined;
  industry?: string | undefined;
  description?: string | undefined;
  culture?: string | undefined;
  techStack: string[];
  reputationScore?: number | undefined;
  recentNews?: string[] | undefined;
  competitors?: string[] | undefined;
  citations: SonarCitation[];
  researchedAt: string;
}

export interface RoleResearchResult {
  title: string;
  keyResponsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: string;
  salaryRange?: { minLpa: number; maxLpa: number } | undefined;
  remotePolicy?: string | undefined;
  workLifeBalance?: string | undefined;
  growthPath?: string | undefined;
  citations: SonarCitation[];
  researchedAt: string;
}
