import { PerplexityClient, researchEmployer, researchRole } from "@jobblitz/research";

const client = process.env.PERPLEXITY_API_KEY
  ? new PerplexityClient(process.env.PERPLEXITY_API_KEY)
  : undefined;

export interface ResearchInput {
  type: "employer" | "role";
  companyName?: string;
  jobTitle?: string;
}

export async function researchAgent(input: ResearchInput): Promise<unknown> {
  if (!client) {
    throw new Error("PERPLEXITY_API_KEY not configured");
  }

  if (input.type === "employer" && input.companyName) {
    return researchEmployer(client, input.companyName);
  }

  if (input.type === "role" && input.jobTitle) {
    return researchRole(client, input.jobTitle, input.companyName);
  }

  throw new Error("Invalid research input");
}
