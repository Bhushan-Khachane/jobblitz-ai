import { redactPii } from "@jobblitz/security";

export interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
  service: string;
  requestId?: string | undefined;
  userId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export class StructuredLogger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  private log(level: LogEntry["level"], message: string, meta?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      message: redactPii(message),
      timestamp: new Date().toISOString(),
      service: this.service,
      metadata: meta ? redactObject(meta) : undefined,
    };
    console.log(JSON.stringify(entry));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log("debug", message, meta);
  }
  info(message: string, meta?: Record<string, unknown>) {
    this.log("info", message, meta);
  }
  warn(message: string, meta?: Record<string, unknown>) {
    this.log("warn", message, meta);
  }
  error(message: string, meta?: Record<string, unknown>) {
    this.log("error", message, meta);
  }
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = redactPii(value);
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function createLogger(service: string): StructuredLogger {
  return new StructuredLogger(service);
}
