import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { trace, SpanStatusCode, type Span } from "@opentelemetry/api";

const SERVICE_NAME = process.env.SERVICE_NAME || "jobblitz";
const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

let sdk: NodeSDK | null = null;

export function initTracer(serviceName = SERVICE_NAME) {
  if (sdk) return;

  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.RELEASE || "2.0.0",
  });

  const exporter = new OTLPTraceExporter({
    ...(OTEL_ENDPOINT ? { url: OTEL_ENDPOINT } : {}),
  });

  sdk = new NodeSDK({
    resource,
    traceExporter: exporter,
    spanProcessor: new BatchSpanProcessor(exporter),
  });

  sdk.start();
}

export function shutdownTracer(): Promise<void> {
  if (!sdk) return Promise.resolve();
  return sdk.shutdown();
}

export const tracer = trace.getTracer(SERVICE_NAME);

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
    }
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      recordError(span, err);
      throw err;
    } finally {
      span.end();
    }
  });
}

export function recordError(span: Span, error: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error));
  span.recordException(err);
  span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
}
