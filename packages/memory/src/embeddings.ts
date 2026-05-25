export interface EmbeddingClient {
  embed(texts: string[]): Promise<number[][]>;
}

export class OpenAIEmbeddingClient implements EmbeddingClient {
  private apiKey: string;
  private model: string;
  private dimensions: number;

  constructor(apiKey: string, model = "text-embedding-3-small", dimensions = 1536) {
    this.apiKey = apiKey;
    this.model = model;
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding error: ${response.status} ${await response.text()}`);
    }

    const json = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    return json.data.map((d) => d.embedding);
  }
}

export class FakeEmbeddingClient implements EmbeddingClient {
  async embed(texts: string[]): Promise<number[][]> {
    // Deterministic fake embeddings for testing
    return texts.map((t) => {
      const vec = new Array(1536).fill(0);
      for (let i = 0; i < Math.min(t.length, 1536); i++) {
        vec[i] = (t.charCodeAt(i) % 100) / 100;
      }
      return vec;
    });
  }
}

export function createEmbeddingClient(apiKey?: string): EmbeddingClient {
  const key = apiKey || (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : undefined);
  if (key) return new OpenAIEmbeddingClient(key);
  return new FakeEmbeddingClient();
}
