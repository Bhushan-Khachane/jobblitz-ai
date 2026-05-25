import type { Profile, Job } from "@jobblitz/types";

export interface ResumeInput {
  userId: string;
  profile: Profile;
  job: Job;
}

export interface ResumeOutput {
  tailoredResumeText: string;
  highlights: string[];
  keywordsMatched: string[];
}

export async function resumeAgent(input: ResumeInput): Promise<ResumeOutput> {
  const jobSkills = new Set((input.job.skillsRequired || []).map((s) => s.toLowerCase()));
  const profileSkills = new Set((input.profile.skills || []).map((s) => s.toLowerCase()));
  const matched = Array.from(jobSkills).filter((s) => profileSkills.has(s));
  const missing = Array.from(jobSkills).filter((s) => !profileSkills.has(s));

  const highlights = [
    `Experienced in ${matched.slice(0, 3).join(", ")}`,
    `Targeting ${input.job.title} role`,
  ];

  if (missing.length > 0) {
    highlights.push(`Familiar with ${missing.slice(0, 2).join(", ")}`);
  }

  return {
    tailoredResumeText: `Tailored resume for ${input.job.title} at ${input.job.company}`,
    highlights,
    keywordsMatched: matched,
  };
}
