import { PerplexityClient } from "./sonar";
import type { EmployerResearchResult } from "./types";

export async function researchEmployer(
  client: PerplexityClient,
  companyName: string
): Promise<EmployerResearchResult> {
  const query = `Research ${companyName}. Provide: industry, approximate size, tech stack, company culture summary, recent news (last 12 months), key competitors, and a reputation assessment (score 1-5). Be concise.`;

  const response = await client.queryWithRetry({ query, model: "sonar-pro" });
  const answer = response.answer;

  const techStack = extractTechStack(answer);
  const size = extractField(answer, /size[\s\w]*:?\s*(.+)/i) || extractField(answer, /employees[\s\w]*:?\s*(.+)/i);
  const industry = extractField(answer, /industry[\s\w]*:?\s*(.+)/i);
  const reputationScore = extractReputationScore(answer);

  return {
    name: companyName,
    size,
    industry,
    description: answer.slice(0, 2000),
    culture: extractField(answer, /culture[\s\w]*:?\s*(.+)/i),
    techStack,
    reputationScore,
    recentNews: extractList(answer, /news[\s\w]*:?/i),
    competitors: extractList(answer, /competitors?[\s\w]*:?/i),
    citations: response.citations,
    researchedAt: new Date().toISOString(),
  };
}

function extractTechStack(text: string): string[] {
  const common = [
    "Python", "JavaScript", "TypeScript", "Java", "Go", "Rust", "C++", "C#", "Ruby", "PHP",
    "React", "Vue", "Angular", "Next.js", "Node.js", "Django", "Flask", "Spring",
    "AWS", "Azure", "GCP", "Kubernetes", "Docker", "Terraform", "Linux",
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch",
    "TensorFlow", "PyTorch", "Spark", "Kafka", "Airflow",
    "GraphQL", "REST", "gRPC", "Microservices", "Serverless",
  ];
  const found = common.filter((tech) => new RegExp(`\\b${tech}\\b`, "i").test(text));
  return [...new Set(found)];
}

function extractField(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  return match?.[1]?.trim();
}

function extractReputationScore(text: string): number | undefined {
  const match = text.match(/reputation\s*(?:score|rating)?[:\s]*([\d.]+)\s*\/\s*5/i);
  if (match) return Math.min(5, Math.max(1, Number(match[1])));
  return undefined;
}

function extractList(text: string, headerRegex: RegExp): string[] {
  const lines = text.split("\n");
  const result: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (headerRegex.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (/^#{1,3}\s/.test(line) || line.trim() === "") {
        inSection = false;
        continue;
      }
      const cleaned = line.replace(/^[-*\d.]+\s*/, "").trim();
      if (cleaned) result.push(cleaned);
    }
  }
  return result;
}
