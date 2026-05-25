import type { SonarQuery, SonarResponse, SonarCitation } from "./types";

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

export class PerplexityClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = PERPLEXITY_API_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async query(input: SonarQuery): Promise<SonarResponse> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model || "sonar",
        messages: [{ role: "user", content: input.query }],
        max_tokens: input.maxTokens || 1024,
        temperature: input.temperature ?? 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status} ${await response.text()}`);
    }

    const json = (await response.json()) as {
      choices: Array<{
        message: { content: string };
      }>;
      citations?: string[];
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };

    const answer = json.choices[0]?.message?.content || "";
    const citations: SonarCitation[] = (json.citations || []).map((url) => ({ url }));

    return {
      answer,
      citations,
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined,
    };
  }

  async queryWithRetry(input: SonarQuery, retries = 2): Promise<SonarResponse> {
    let lastError: Error | undefined;
    for (let i = 0; i <= retries; i++) {
      try {
        return await this.query(input);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (i < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        }
      }
    }
    throw lastError;
  }
}
