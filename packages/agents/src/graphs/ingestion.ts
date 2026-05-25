import { StateGraph, START, END } from "../engine";
import type { IngestionState } from "../state";

function normalizeJobs(state: IngestionState): IngestionState {
  const normalized = state.rawJobs.map((raw: unknown) => {
    const r = raw as Record<string, unknown>;
    return {
      id: crypto.randomUUID(),
      userId: state.userId,
      platform: String(r.platform || "unknown"),
      title: String(r.title || ""),
      company: String(r.company || ""),
      location: r.location ? String(r.location) : undefined,
      description: r.description ? String(r.description) : undefined,
      skillsRequired: Array.isArray(r.skillsRequired) ? r.skillsRequired.map(String) : undefined,
      salaryMinLpa: typeof r.salaryMinLpa === "number" ? r.salaryMinLpa : undefined,
      salaryMaxLpa: typeof r.salaryMaxLpa === "number" ? r.salaryMaxLpa : undefined,
      status: "discovered",
      createdAt: new Date().toISOString(),
    } as IngestionState["normalizedJobs"][number];
  });
  return { ...state, normalizedJobs: normalized };
}

function dedupeJobs(state: IngestionState): IngestionState {
  const seen = new Set<string>();
  const deduped = state.normalizedJobs.filter((job) => {
    const hash = `${job.title.toLowerCase()}-${job.company.toLowerCase()}`;
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
  return { ...state, normalizedJobs: deduped };
}

export const ingestionGraph = new StateGraph<IngestionState>()
  .addNode("normalize", normalizeJobs)
  .addNode("dedupe", dedupeJobs)
  .addEdge(START, "normalize")
  .addEdge("normalize", "dedupe")
  .addEdge("dedupe", END)
  .compile();
