import { Stagehand } from "@browserbasehq/stagehand";
import type { Page } from "@browserbasehq/stagehand/lib/v3/understudy/page";

export interface StagehandSession {
  stagehand: Stagehand;
  page: Page;
  cleanup(): Promise<void>;
}

export async function createStagehandSession(config: {
  headless?: boolean;
  model?: string;
}): Promise<StagehandSession> {
  const modelName = (config.model || process.env.STAGEHAND_MODEL || "gpt-4o-mini") as
    | "gpt-4o-mini"
    | "gpt-4.1-mini"
    | "gpt-4.1-nano"
    | string;

  const clientOptions: { modelName: string; apiKey?: string } = {
    modelName,
  };
  if (process.env.OPENAI_API_KEY) {
    clientOptions.apiKey = process.env.OPENAI_API_KEY;
  }

  const stagehand = new Stagehand({
    env: "LOCAL",
    localBrowserLaunchOptions: {
      headless: config.headless ?? true,
      viewport: { width: 1280, height: 800 },
    },
    model: clientOptions,
    verbose: 0,
    selfHeal: true,
  });

  await stagehand.init();
  const page = stagehand.context.activePage();
  if (!page) {
    throw new Error("Stagehand failed to initialize a page");
  }

  return {
    stagehand,
    page,
    async cleanup() {
      try {
        await stagehand.close();
      } catch {
        // Best-effort cleanup
      }
    },
  };
}
