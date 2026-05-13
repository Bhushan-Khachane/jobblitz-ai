"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import api from "@/lib/api";

export default function ReviewJobsPage() {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    fetchScores();
  }, []);

  const fetchScores = async () => {
    try {
      const res = await api.get("/scoring/job-scores");
      setScores(res.data || []);
    } catch (err) {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionId(id);
    try {
      await api.post(`/applications/${id}/approve`);
      setScores((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to approve");
    } finally {
      setActionId(null);
    }
  };

  const handleSkip = async (id: string) => {
    setActionId(id);
    try {
      // TODO: implement skip endpoint
      setScores((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to skip");
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Review Jobs</h1>
        <p className="text-muted-foreground mt-1">
          Approve or skip scored job leads before applying.
        </p>
      </div>

      <div className="grid gap-4">
        {scores.length === 0 && (
          <div className="p-8 text-center text-muted-foreground border border-dashed border-white/10 rounded-xl">
            No jobs awaiting review. Run discovery and scoring first.
          </div>
        )}
        {scores.map((score) => (
          <div
            key={score.id}
            className="p-4 rounded-xl bg-card border border-border flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-foreground">{score.job_title || "Job Lead"}</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    score.fit_score >= 80
                      ? "bg-green-500/20 text-green-400"
                      : score.fit_score >= 60
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  Fit {score.fit_score}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{score.gap_notes || "No gap notes"}</p>
              {score.must_have_match && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(score.must_have_match).map(([k, v]: [string, any]) => (
                    <span
                      key={k}
                      className={`px-2 py-0.5 rounded text-xs ${
                        v === "matched"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {k}: {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleApprove(score.id)}
                disabled={actionId === score.id}
                className="px-3 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-sm font-medium flex items-center gap-1 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" /> Approve
              </button>
              <button
                onClick={() => handleSkip(score.id)}
                disabled={actionId === score.id}
                className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm font-medium flex items-center gap-1 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> Skip
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
