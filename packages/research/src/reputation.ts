import { PerplexityClient } from "./sonar";

export interface ReputationSnapshot {
  score?: number | undefined;
  sentiment: "positive" | "mixed" | "negative" | "unknown";
  summary: string;
  sources: string[];
}

export async function getReputationSnapshot(
  client: PerplexityClient,
  companyName: string
): Promise<ReputationSnapshot> {
  const query = `What is the current reputation and employee sentiment for ${companyName}? Look at Glassdoor, LinkedIn, and recent news. Rate sentiment as positive, mixed, or negative. Be concise.`;

  const response = await client.queryWithRetry({ query, model: "sonar-pro" });
  const answer = response.answer.toLowerCase();

  let sentiment: ReputationSnapshot["sentiment"] = "unknown";
  if (answer.includes("positive") && !answer.includes("negative")) sentiment = "positive";
  else if (answer.includes("negative") && !answer.includes("positive")) sentiment = "negative";
  else if (answer.includes("mixed") || (answer.includes("positive") && answer.includes("negative"))) {
    sentiment = "mixed";
  }

  const scoreMatch = response.answer.match(/(\d\.?\d?)\s*\/\s*5/);
  const score = scoreMatch ? Math.min(5, Math.max(1, Number(scoreMatch[1]))) : undefined;

  return {
    score,
    sentiment,
    summary: response.answer.slice(0, 1000),
    sources: response.citations.map((c) => c.url),
  };
}
