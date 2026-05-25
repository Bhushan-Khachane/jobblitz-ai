export interface SpanContext {
  traceId: string;
  spanId: string;
  parentId?: string | undefined;
}

export class Tracer {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  startSpan(name: string, parent?: SpanContext): SpanContext {
    const span: SpanContext = {
      traceId: parent?.traceId || generateId(),
      spanId: generateId(),
      parentId: parent?.spanId,
    };
    console.log(JSON.stringify({ event: "span_start", service: this.service, name, ...span }));
    return span;
  }

  endSpan(span: SpanContext, status: "ok" | "error" = "ok") {
    console.log(JSON.stringify({ event: "span_end", service: this.service, spanId: span.spanId, status }));
  }
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createTracer(service: string): Tracer {
  return new Tracer(service);
}
