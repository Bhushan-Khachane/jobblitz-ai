import type { Job } from "@jobblitz/types";

export interface ExtractionExample {
  raw: string;
  expected: Partial<Job>;
}

export const EXTRACTION_EXAMPLES: ExtractionExample[] = [
  {
    raw: "Senior Software Engineer at Google, Bangalore. Requires 5+ years Python, Kubernetes. Salary: 40-60 LPA.",
    expected: {
      title: "Senior Software Engineer",
      company: "Google",
      location: "Bangalore",
      yearsExperienceMin: 5,
      skillsRequired: ["Python", "Kubernetes"],
      salaryMinLpa: 40,
      salaryMaxLpa: 60,
    },
  },
];

export function evaluateExtraction(actual: Partial<Job>, expected: Partial<Job>): number {
  let score = 0;
  let total = 0;
  for (const key of Object.keys(expected) as Array<keyof Job>) {
    total++;
    const exp = expected[key];
    const act = actual[key];
    if (Array.isArray(exp) && Array.isArray(act)) {
      const overlap = exp.filter((x) => act.includes(x)).length;
      score += overlap / Math.max(exp.length, act.length);
    } else if (exp === act) {
      score++;
    }
  }
  return total > 0 ? score / total : 0;
}
