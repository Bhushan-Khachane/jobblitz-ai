"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  MapPin,
  Briefcase,
  Clock,
  ExternalLink,
  CheckCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { useRunStatus } from "@/hooks/useRunStatus";
import { discoveryAPI } from "@/lib/api";

export default function DiscoveryPage() {
  const [keywords, setKeywords] = useState("Python Developer");
  const [location, setLocation] = useState("Nagpur");
  const [experience, setExperience] = useState("2");
  const [jobAge, setJobAge] = useState("7");
  const [portal, setPortal] = useState("naukri");
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { runStatus, isPolling } = useRunStatus(runId);

  const jobAgeOptions = [
    { value: "1", label: "Last 1 day" },
    { value: "3", label: "Last 3 days" },
    { value: "7", label: "Last 7 days" },
    { value: "30", label: "Last 30 days" },
  ];

  // Fetch leads when run reaches terminal state
  useEffect(() => {
    if (
      (runStatus?.status === "pending_approval" || runStatus?.status === "completed") &&
      leads.length === 0
    ) {
      discoveryAPI
        .jobLeads({ portal, page: 1, page_size: 20 })
        .then((res) => setLeads(res.items || []))
        .catch(() => {
          /* silently fail */
        });
    }
  }, [runStatus?.status, leads.length, portal]);

  const handleRunDiscovery = async () => {
    setLoading(true);
    setError(null);
    setLeads([]);
    try {
      let result = await discoveryAPI.run({
        keywords,
        location,
        portal,
        years_experience: parseInt(experience) || 2,
        job_age_days: parseInt(jobAge) || 7,
      });

      // If ADK is down, fall back to direct scrape immediately
      if (!result.run_id || result.status === "error") {
        result = await discoveryAPI.runDirect({
          keywords,
          location,
          portal,
          years_experience: parseInt(experience) || 2,
          job_age_days: parseInt(jobAge) || 7,
        });
      }

      if (result.status === "completed") {
        // Already done — don't start polling, just load leads directly
        const res = await discoveryAPI.jobLeads({ portal, page: 1, page_size: 20 });
        setLeads(res.items || []);
        setRunId(null); // don't trigger useRunStatus polling
      } else {
        setRunId(result.run_id); // only poll if still running
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Discovery failed");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (leadId: string) => {
    try {
      await discoveryAPI.approveLead(leadId);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, decision: "approve" } : l))
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to approve");
    }
  };

  const handleSkip = async (leadId: string) => {
    try {
      await discoveryAPI.skipLead(leadId);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, decision: "skip" } : l))
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to skip");
    }
  };

  const statusLabel = () => {
    if (!runStatus) return "";
    switch (runStatus.status) {
      case "queued":
        return "🔍 Starting discovery...";
      case "running":
        return `📋 Running workflow...`;
      case "pending_approval":
        return `✅ ${runStatus.pending_approvals ?? 0} jobs sent to Approval Queue`;
      case "completed":
        return `✅ Discovery complete — ${leads.length} jobs found`;
      case "skipped":
        return "No matching jobs found. Try different keywords.";
      case "failed":
        return `Discovery failed: ${runStatus.error || "Unknown error"}`;
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Discovery</h1>
          <p className="text-muted-foreground mt-1">
            Find new job leads from connected portals.
          </p>
        </div>
      </div>

      {/* Search Form */}
      <div className="p-4 rounded-xl bg-card border border-border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Keywords</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Python Developer"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Nagpur, Remote"
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Experience (years)</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                type="number"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="3"
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Job Age</label>
            <div className="relative">
              <Clock className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <select
                value={jobAge}
                onChange={(e) => setJobAge(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
              >
                {jobAgeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <select
            value={portal}
            onChange={(e) => setPortal(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="naukri">Naukri</option>
            <option value="linkedin" disabled>LinkedIn (coming soon)</option>
          </select>
          <button
            onClick={handleRunDiscovery}
            disabled={loading || isPolling}
            className="px-4 py-2 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {loading || isPolling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Run Discovery
          </button>
        </div>
      </div>

      {/* Live Status */}
      {(isPolling || runStatus) && (
        <div
          className={`p-3 rounded-lg text-sm border ${
            runStatus?.status === "pending_approval" || runStatus?.status === "completed"
              ? "bg-green-500/10 text-green-400 border-green-500/20"
              : runStatus?.status === "skipped" || runStatus?.status === "failed"
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : "bg-primary-500/10 text-primary-400 border-primary-500/20"
          }`}
        >
          <div className="flex items-center gap-2">
            {isPolling && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{statusLabel()}</span>
          </div>
          {runStatus?.status === "pending_approval" && (
            <Link
              href="/approval-queue"
              className="inline-flex items-center gap-1 mt-1 text-xs font-medium underline hover:text-green-300"
            >
              Review now <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm">
          {error}
        </div>
      )}

      {/* Leads Table */}
      {leads.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Job Leads</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Title</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Company</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Location</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Experience</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Fit Score</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Decision</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-border/50 hover:bg-white/5"
                  >
                    <td className="py-3 px-3">
                      <a
                        href={lead.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground hover:text-primary-400 flex items-center gap-1"
                      >
                        {lead.title}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {lead.company}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {lead.location || "—"}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {lead.experience || "—"}
                    </td>
                    <td className="py-3 px-3">
                      {lead.fit_score != null ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            lead.fit_score >= 80
                              ? "bg-green-500/20 text-green-400"
                              : lead.fit_score >= 60
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {lead.fit_score}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {lead.decision === "auto" && (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      )}
                      {lead.decision === "approve" && (
                        <CheckCircle className="w-4 h-4 text-amber-400" />
                      )}
                      {lead.decision === "skip" && (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      {!lead.decision && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApprove(lead.id)}
                          disabled={lead.decision === "approve"}
                          className="px-2 py-1 text-xs bg-primary-500/20 text-primary-400 rounded hover:bg-primary-500/30 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleSkip(lead.id)}
                          disabled={lead.decision === "skip"}
                          className="px-2 py-1 text-xs bg-white/5 text-muted-foreground rounded hover:bg-white/10 disabled:opacity-50"
                        >
                          Skip
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {leads.length === 0 && !loading && !isPolling && (
        <div className="p-8 text-center text-muted-foreground border border-dashed border-white/10 rounded-xl">
          No job leads yet. Fill the search form and run discovery.
        </div>
      )}
    </div>
  );
}
