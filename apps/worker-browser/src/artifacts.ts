import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type { Page } from "playwright";

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || "/tmp/jobblitz-artifacts";

export interface Artifact {
  path: string;
  type: "screenshot" | "dom" | "trace";
  sizeBytes: number;
}

export class ArtifactsService {
  async ensureDir(): Promise<void> {
    await mkdir(ARTIFACTS_DIR, { recursive: true });
  }

  async screenshot(page: Page, prefix: string): Promise<Artifact> {
    await this.ensureDir();
    const filename = `${prefix}-${Date.now()}.png`;
    const filepath = join(ARTIFACTS_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    return { path: filepath, type: "screenshot", sizeBytes: 0 };
  }

  async domSnapshot(page: Page, prefix: string): Promise<Artifact> {
    await this.ensureDir();
    const filename = `${prefix}-${Date.now()}.html`;
    const filepath = join(ARTIFACTS_DIR, filename);
    const html = await page.content();
    await writeFile(filepath, html, "utf-8");
    return { path: filepath, type: "dom", sizeBytes: Buffer.byteLength(html, "utf-8") };
  }
}

export const artifacts = new ArtifactsService();
