import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export interface BrowserSession {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  createdAt: Date;
}

class SessionManager {
  private sessions = new Map<string, BrowserSession>();
  private counter = 0;

  async createSession(headless = true, proxy?: string): Promise<BrowserSession> {
    const id = `session-${Date.now()}-${++this.counter}`;
    const launchOptions: { headless: boolean; proxy?: { server: string } } = { headless };
    if (proxy) {
      launchOptions.proxy = { server: proxy };
    }
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    const session: BrowserSession = { id, browser, context, page, createdAt: new Date() };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): BrowserSession | undefined {
    return this.sessions.get(id);
  }

  async closeSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;
    await session.context.close();
    await session.browser.close();
    this.sessions.delete(id);
  }

  async closeAll(): Promise<void> {
    for (const [id] of this.sessions) {
      await this.closeSession(id);
    }
  }

  listSessions(): Array<{ id: string; createdAt: Date }> {
    return Array.from(this.sessions.values()).map((s) => ({ id: s.id, createdAt: s.createdAt }));
  }
}

export const sessionManager = new SessionManager();
