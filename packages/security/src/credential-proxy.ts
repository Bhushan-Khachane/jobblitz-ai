import { randomUUID } from "crypto";

interface ProxyEntry {
  creds: Record<string, string>;
  expiresAt: number;
  used: boolean;
}

class CredentialProxy {
  private store = new Map<string, ProxyEntry>();
  private evictionTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startEvictionLoop();
  }

  put(userId: string, platform: string, creds: Record<string, string>): string {
    const token = randomUUID();
    this.store.set(token, {
      creds: { ...creds, _userId: userId, _platform: platform },
      expiresAt: Date.now() + 120_000,
      used: false,
    });
    return token;
  }

  get(token: string): Record<string, string> | undefined {
    const entry = this.store.get(token);
    if (!entry) return undefined;
    if (entry.used) {
      this.store.delete(token);
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(token);
      return undefined;
    }
    entry.used = true;
    return entry.creds;
  }

  startEvictionLoop(): void {
    if (this.evictionTimer) return;
    this.evictionTimer = setInterval(() => {
      const now = Date.now();
      for (const [token, entry] of this.store) {
        if (now > entry.expiresAt || entry.used) {
          this.store.delete(token);
        }
      }
    }, 30_000);
  }

  stopEvictionLoop(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
  }
}

export const credentialProxy = new CredentialProxy();
