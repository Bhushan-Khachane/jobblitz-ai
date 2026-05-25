"use client";

import { useState, useCallback, useEffect } from "react";
import { RefreshCw, SlidersHorizontal, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import JobRecommendationCard from "./JobRecommendationCard";
import JobDiscoveryTrigger from "./JobDiscoveryTrigger";
import { jobsAPI } from "@/lib/api";
import type { Job } from "@/lib/api";

const TIERS = [
  { key: "", label: "All", count: 0 },
  { key: "APPLY_NOW", label: "Apply Now" },
  { key: "STRONG_FIT", label: "Strong Fit" },
  { key: "CONSIDER", label: "Consider" },
];

const SORTS = [
  { key: "matchScore", label: "Match Score" },
  { key: "salary", label: "Salary" },
  { key: "posted", label: "Posted Date" },
];

export default function JobRecommendationsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [tier, setTier] = useState("");
  const [sort, setSort] = useState("matchScore");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchJobs = useCallback(
    async (reset = false) => {
      setLoading(true);
      try {
        const newOffset = reset ? 0 : offset;
        const params: { status?: string; limit: number; offset: number; sort?: string } = {
          limit: 20,
          offset: newOffset,
        };
        if (sort) params.sort = sort;
        const data = await jobsAPI.list(params);
        if (reset) {
          setJobs(data);
        } else {
          setJobs((prev) => [...prev, ...data]);
        }
        setHasMore(data.length === 20);
        if (reset) setOffset(20);
        else setOffset(newOffset + data.length);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [sort, offset]
  );

  useEffect(() => {
    fetchJobs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, sort]);

  const handleDismiss = (jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  };

  const handleApply = (jobId: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: "queued" } : j))
    );
  };

  const handleDiscover = () => {
    setTimeout(() => fetchJobs(true), 4000);
  };

  const exportCSV = () => {
    if (!jobs.length) return;
    const rows = [
      ["Role", "Company", "Location", "Score", "Tier", "Apply Link"],
      ...jobs.map((j) => [
        j.title || "",
        j.company || "",
        j.location || "",
        String(j.matchScore ?? 0),
        j.matchScore && j.matchScore >= 90 ? "APPLY_NOW" : j.matchScore && j.matchScore >= 75 ? "STRONG_FIT" : "CONSIDER",
        j.applyUrl || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-recommendations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Job Recommendations</h1>
          <p className="text-sm text-white/40 mt-1">
            AI-scored jobs matched to your profile
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs"
            onClick={() => fetchJobs(true)}
            disabled={loading}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs"
            onClick={exportCSV}
            disabled={!jobs.length}
          >
            <Download className="w-3 h-3" />
            Export CSV
          </Button>
          <JobDiscoveryTrigger onDiscover={handleDiscover} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {TIERS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTier(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              tier === t.key
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                : "bg-white/5 text-white/40 border border-white/5 hover:bg-white/10 hover:text-white/60"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <SlidersHorizontal className="w-3 h-3 text-white/30" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg text-xs text-white/70 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key} className="bg-[#080810]">
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Jobs grid */}
      {jobs.length === 0 && !loading && (
        <div className="text-center py-20">
          <p className="text-white/30 text-sm">No job recommendations yet.</p>
          <p className="text-white/20 text-xs mt-1">
            Click &quot;Find Best Jobs&quot; to start discovery.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {jobs.map((job) => (
          <JobRecommendationCard
            key={job.id}
            job={job}
            onDismiss={handleDismiss}
            onApply={handleApply}
          />
        ))}
      </div>

      {hasMore && jobs.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => fetchJobs(false)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}
