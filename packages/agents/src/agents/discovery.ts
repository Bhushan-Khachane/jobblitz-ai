import { ingestionGraph } from "../graphs/ingestion";
import type { IngestionState } from "../state";

export interface DiscoveryInput {
  userId: string;
  platform: string;
  keywords: string;
  location?: string;
}

export async function discoveryAgent(input: DiscoveryInput): Promise<IngestionState> {
  // In production, this would scrape job boards via the browser worker
  const rawJobs = [
    {
      platform: input.platform,
      title: `${input.keywords} Engineer`,
      company: "ExampleCorp",
      location: input.location,
    },
  ];

  const initialState: IngestionState = {
    userId: input.userId,
    rawJobs,
    normalizedJobs: [],
  };

  return ingestionGraph.invoke(initialState);
}
