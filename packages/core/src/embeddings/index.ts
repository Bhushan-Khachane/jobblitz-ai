import { OpenAIEmbeddings } from "@langchain/openai";

export class EmbeddingService {
  private client: OpenAIEmbeddings;

  constructor(apiKey: string) {
    this.client = new OpenAIEmbeddings({
      apiKey,
      modelName: "text-embedding-3-small",
    });
  }

  async embedText(text: string): Promise<number[]> {
    return this.client.embedQuery(text);
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    const chunkSize = 100;
    for (let i = 0; i < texts.length; i += chunkSize) {
      const chunk = texts.slice(i, i + chunkSize);
      const embeddings = await this.client.embedDocuments(chunk);
      out.push(...embeddings);
    }
    return out;
  }
}

export function createEmbeddingService(apiKey?: string): EmbeddingService {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required for EmbeddingService");
  return new EmbeddingService(key);
}
