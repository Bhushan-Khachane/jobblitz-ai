import { MeterProvider, PeriodicExportingMetricReader, ConsoleMetricExporter } from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { metrics } from "@opentelemetry/api";

const SERVICE_NAME = process.env.SERVICE_NAME || "jobblitz";
const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

let meterProvider: MeterProvider | null = null;

export function initMetrics(serviceName = SERVICE_NAME) {
  if (meterProvider) return;

  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.RELEASE || "2.0.0",
  });

  const exporter = OTEL_ENDPOINT
    ? new OTLPMetricExporter({
        url: `${OTEL_ENDPOINT.replace(/\/v1\/traces$/, "")}/v1/metrics`,
      })
    : new ConsoleMetricExporter();

  meterProvider = new MeterProvider({
    resource,
    readers: [new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60000 })],
  });

  metrics.setGlobalMeterProvider(meterProvider);
}

export function shutdownMetrics(): Promise<void> {
  if (!meterProvider) return Promise.resolve();
  return meterProvider.shutdown();
}

const meter = metrics.getMeter(SERVICE_NAME);

export const applicationsSubmittedCounter = meter.createCounter("jobblitz.applications.submitted", {
  description: "Total applications submitted",
});

export const matchScoreHistogram = meter.createHistogram("jobblitz.match.score", {
  description: "Match score distribution",
  unit: "1",
});

export const agentLatencyHistogram = meter.createHistogram("jobblitz.agent.latency", {
  description: "Agent step latency in ms",
  unit: "ms",
});

export const llmCallDuration = meter.createHistogram("jobblitz.llm.duration", {
  description: "LLM call duration in ms",
  unit: "ms",
});

export const dailyLimitHitsCounter = meter.createCounter("jobblitz.ratelimit.daily.hits", {
  description: "Daily application limit hits",
});
