import { BaseAgent } from "../BaseAgent";

export interface JobListing {
  sourceId: string;
  title: string;
  company: string;
  location?: string | undefined;
  jdText: string;
  url: string;
  ctcRange?: { min?: number; max?: number; currency: string };
  experienceRequired?: string;
  skills: string[];
  postedDate?: string;
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
  name: string;
  search(input: HunterInput): Promise<JobListing[]>;
}

// ── LinkedIn Provider (stub: uses public job search API or scraping) ──
class LinkedInProvider implements JobProviderAdapter {
  name = "linkedin";
  async search(_input: HunterInput): Promise<JobListing[]> {
    // TODO: integrate with LinkedIn Jobs API or browser-based scraping via @jobblitz/browser
    // Requires LinkedIn API v2 application or authenticated scraping.
    return [];
  }
}

// ── Naukri Provider (stub: uses browser automation or API) ──
class NaukriProvider implements JobProviderAdapter {
  name = "naukri";
  async search(_input: HunterInput): Promise<JobListing[]> {
    // TODO: integrate with Naukri search via Playwright browser worker
    // Requires session cookies from @jobblitz/browser session manager.
    return [];
  }
}

// ── Indeed Provider (stub: uses RSS or API) ──
class IndeedProvider implements JobProviderAdapter {
  name = "indeed";
  async search(_input: HunterInput): Promise<JobListing[]> {
    // TODO: integrate with Indeed API (requires publisher ID)
    return [];
  }
}

// ── Mock Provider (fallback for development) ──
class MockJobProvider implements JobProviderAdapter {
  name = "mock";
  async search(input: HunterInput): Promise<JobListing[]> {
    return [
      {
        sourceId: `mock-1-${Date.now()}`,
        title: `${input.keywords} Engineer`,
        company: "TechCorp",
        location: input.location ?? "Remote",
        jdText: `Looking for a ${input.keywords} engineer with strong problem-solving skills.`,
        url: "https://example.com/job/1",
        ctcRange: { min: 10, max: 20, currency: "INR-LPA" },
        experienceRequired: input.experienceLevel ?? "2-5 years",
        skills: [input.keywords, "communication", "teamwork"],
        postedDate: new Date().toISOString(),
        source: "mock",
      },
      {
        sourceId: `mock-2-${Date.now()}`,
        title: `Senior ${input.keywords}`,
        company: "GlobalTech",
        location: input.location ?? "Bangalore",
        jdText: `Senior ${input.keywords} role with leadership opportunities.`,
        url: "https://example.com/job/2",
        ctcRange: { min: 25, max: 40, currency: "INR-LPA" },
        experienceRequired: input.experienceLevel ?? "5+ years",
        skills: [input.keywords, "architecture", "mentoring"],
        postedDate: new Date().toISOString(),
        source: "mock",
      },
    ];
  }
}

export class HunterAgent extends BaseAgent<HunterInput, HunterOutput> {
  readonly name = "HunterAgent";
  readonly model = "provider-adapter";
  private providers: JobProviderAdapter[];

  constructor(providers?: JobProviderAdapter[]) {
    super();
    this.providers = providers ?? [
      new LinkedInProvider(),
      new NaukriProvider(),
      new IndeedProvider(),
      new MockJobProvider(),
    ];
  }

  protected async run(input: HunterInput): Promise<HunterOutput> {
    const allJobs: JobListing[] = [];
    let anySuccess = false;
    for (const provider of this.providers) {
      try {
        const results = await provider.search(input);
        if (results.length > 0) {
          anySuccess = true;
        }
        allJobs.push(...results);
      } catch (err) {
        console.error(`[HunterAgent] provider ${provider.name} failed:`, err instanceof Error ? err.message : String(err));
      }
    }
    return { jobs: allJobs, cached: false, quotaExhausted: !anySuccess };
  }

  protected fallbackResult(_input: HunterInput): HunterOutput {
    return { jobs: [], cached: false, quotaExhausted: true };
  }

  addProvider(provider: JobProviderAdapter): void {
    this.providers.push(provider);
  }
}

export const hunterAgent = new HunterAgent();
