import type { Context, Next } from "hono";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { agentLatencyHistogram } from "@jobblitz/observability";

export async function otelMiddleware(c: Context, next: Next) {
  const tracer = trace.getTracer("jobblitz-api");
  const start = Date.now();

  await tracer.startActiveSpan(
    `${c.req.method} ${c.req.path}`,
    async (span) => {
      span.setAttribute("http.method", c.req.method);
      span.setAttribute("http.path", c.req.path);
      span.setAttribute("http.route", c.req.path);

      try {
        await next();
        const status = c.res.status;
        span.setAttribute("http.status_code", status);
        span.setStatus({ code: status < 400 ? SpanStatusCode.OK : SpanStatusCode.ERROR });
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        span.end();
        agentLatencyHistogram.record(Date.now() - start, {
          agentName: "api",
          step: c.req.path,
        });
      }
    }
  );
}
