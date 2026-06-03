import { BaseAgent } from "../BaseAgent";
import { PerplexityClient, researchEmployer } from "@jobblitz/research";
import type { CompanyResearch } from "../state";

export class CompanyResearchAgent extends BaseAgent<string, CompanyResearch> {
  readonly name = "CompanyResearchAgent";
  readonly model = "perplexity-sonar-pro";
  private perplexityClient?: PerplexityClient;

  constructor() {
    super();
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (apiKey) {
      this.perplexityClient = new PerplexityClient(apiKey);
    }
  }

  protected async run(companyName: string): Promise<CompanyResearch> {
    if (!this.perplexityClient) {
      console.warn("[CompanyResearchAgent] PERPLEXITY_API_KEY not set, using stub fallback");
      return this.stubResult(companyName);
    }

    try {
      const result = await researchEmployer(this.perplexityClient, companyName);

      return {
        brief: result.description ?? `${companyName} is a technology company operating in India.`,
        news: result.recentNews ?? [`${companyName} recently announced expansion plans.`],
        culture: result.culture ?? "Engineering-first culture with focus on ownership and impact.",
        interviewThemes: result.techStack.length > 0
          ? [...result.techStack, "Behavioral", "Problem-solving under constraints"]
          : ["System design", "Behavioral", "Problem-solving under constraints"],
        glassdoorRating: result.reputationScore,
      };
    } catch (err) {
      console.error(
        `[CompanyResearchAgent] Perplexity research failed:`,
        err instanceof Error ? err.message : String(err)
      );
      return this.stubResult(companyName);
    }
  }

  protected fallbackResult(companyName: string): CompanyResearch {
    return this.stubResult(companyName);
  }

  private stubResult(companyName: string): CompanyResearch {
    return {
      brief: `${companyName} is a technology company operating in India.`,
      news: [`${companyName} recently announced expansion plans.`, `${companyName} ranked in top 100 employers.`],
      culture: "Engineering-first culture with focus on ownership and impact.",
      interviewThemes: ["System design", "Behavioral", "Problem-solving under constraints"],
      glassdoorRating: 4.1,
    };
  }
}

export const companyResearchAgent = new CompanyResearchAgent();
