import { sessionManager } from "./session";
import { artifacts } from "./artifacts";
import { detectAts, type ApplyPayload, classifyError, createStagehandSession } from "@jobblitz/browser";
import type { Page } from "playwright";

export interface NavigatePayload {
  sessionId: string;
  url: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
}

export interface ActPayload {
  sessionId: string;
  action: "click" | "fill" | "select" | "scroll" | "wait";
  selector?: string;
  value?: string;
  timeout?: number;
}

export interface ApplyPayloadExtended extends ApplyPayload {
  sessionId: string;
  applyUrl: string;
  applicationId?: string;
}

export interface BrowserResult {
  success: boolean;
  sessionId?: string | undefined;
  url?: string | undefined;
  title?: string | undefined;
  screenshotPath?: string | undefined;
  domPath?: string | undefined;
  error?: string | undefined;
  category?: string | undefined;
  suggestion?: string | undefined;
  step?: string | undefined;
}

export async function navigate(payload: NavigatePayload): Promise<BrowserResult> {
  const session = sessionManager.getSession(payload.sessionId);
  if (!session) return { success: false, error: "Session not found" };

  try {
    await session.page.goto(payload.url, { waitUntil: payload.waitUntil || "domcontentloaded", timeout: 20000 });
    const screenshot = await artifacts.screenshot(session.page, `nav-${session.id}`);
    return {
      success: true,
      sessionId: session.id,
      url: session.page.url(),
      title: await session.page.title(),
      screenshotPath: screenshot.path,
    };
  } catch (err) {
    const analysis = classifyError(err instanceof Error ? err : new Error(String(err)), "navigate");
    return {
      success: false,
      error: analysis.suggestion,
      category: analysis.category,
      suggestion: analysis.suggestion,
    };
  }
}

export async function act(payload: ActPayload): Promise<BrowserResult> {
  const session = sessionManager.getSession(payload.sessionId);
  if (!session) return { success: false, error: "Session not found" };

  const { action, selector, value, timeout = 8000 } = payload;
  const page = session.page;

  try {
    switch (action) {
      case "click": {
        if (!selector) throw new Error("selector required for click");
        await page.click(selector, { timeout });
        break;
      }
      case "fill": {
        if (!selector || value === undefined) throw new Error("selector and value required for fill");
        await page.fill(selector, value, { timeout });
        break;
      }
      case "select": {
        if (!selector || value === undefined) throw new Error("selector and value required for select");
        await page.selectOption(selector, value, { timeout });
        break;
      }
      case "scroll": {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        break;
      }
      case "wait": {
        await page.waitForTimeout(Number(value) || 1000);
        break;
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const screenshot = await artifacts.screenshot(page, `act-${session.id}`);
    return {
      success: true,
      sessionId: session.id,
      url: page.url(),
      screenshotPath: screenshot.path,
    };
  } catch (err) {
    const analysis = classifyError(err instanceof Error ? err : new Error(String(err)), `act:${action}`);
    return {
      success: false,
      error: analysis.suggestion,
      category: analysis.category,
      suggestion: analysis.suggestion,
      step: `act:${action}`,
    };
  }
}

const ADAPTER_TIMEOUT_MS = 45000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function applyWithAdapter(payload: ApplyPayloadExtended): Promise<BrowserResult> {
  const adapter = detectAts(payload.applyUrl);
  if (!adapter) {
    return { success: false, error: "No ATS adapter found for this URL", step: "detect" };
  }

  let session;
  try {
    // Stagehand adapters require a Stagehand session; existing BrowserSession does not have stagehand
    session = await createStagehandSession({
      headless: process.env.HEADLESS !== "false",
    });

    await session.page.goto(payload.applyUrl, { waitUntil: "domcontentloaded", timeoutMs: 20000 });
    await session.page.waitForTimeout(2000);

    const result = await withTimeout(
      adapter.apply(session.stagehand, session.page as unknown as Page, payload),
      ADAPTER_TIMEOUT_MS,
      `Adapter ${adapter.name}`
    );

    let screenshotPath: string | undefined;
    if (result.screenshotPath) {
      screenshotPath = result.screenshotPath;
    } else {
      const ts = Date.now();
      const prefix = payload.applicationId || `apply_${ts}`;
      screenshotPath = `/tmp/screenshots/${prefix}.png`;
      await session.page.screenshot({ path: screenshotPath, fullPage: true });
    }

    if (result.success) {
      return {
        success: true,
        url: session.page.url(),
        screenshotPath,
        step: result.step,
      };
    }

    const analysis = classifyError(result.error || "apply failed", "apply");
    return {
      success: false,
      error: result.error,
      screenshotPath,
      category: analysis.category,
      suggestion: analysis.suggestion,
      step: result.step,
    };
  } catch (err) {
    const analysis = classifyError(err instanceof Error ? err : new Error(String(err)), "apply");
    return {
      success: false,
      error: analysis.suggestion,
      category: analysis.category,
      suggestion: analysis.suggestion,
      step: "apply",
    };
  } finally {
    if (session) await session.cleanup().catch(() => null);
  }
}
