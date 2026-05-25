export interface SentryConfig {
  dsn?: string | undefined;
  environment?: string | undefined;
  release?: string | undefined;
}

export class SentryClient {
  private config: SentryConfig;

  constructor(config: SentryConfig) {
    this.config = config;
  }

  captureException(err: Error, context?: Record<string, unknown>) {
    if (!this.config.dsn) return;
    console.log(
      JSON.stringify({
        event: "sentry_exception",
        message: err.message,
        stack: err.stack,
        environment: this.config.environment,
        release: this.config.release,
        context,
      })
    );
  }

  captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
    if (!this.config.dsn) return;
    console.log(JSON.stringify({ event: "sentry_message", message, level }));
  }
}

export function createSentryClient(): SentryClient {
  return new SentryClient({
    dsn: typeof process !== "undefined" ? process.env.SENTRY_DSN : undefined,
    environment: typeof process !== "undefined" ? (process.env.NODE_ENV || "development") : "development",
    release: typeof process !== "undefined" ? (process.env.RELEASE || "2.0.0") : "2.0.0",
  });
}
