"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader2, ExternalLink, Sparkles, Copy, FileText } from "lucide-react";
import api from "@/lib/api";

export default function ReviewJobsPage() {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [coverLetterModal, setCoverLetterModal] = useState<any>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<string>("free");

  useEffect(() => {
    fetchScores();
    fetchUserPlan();
  }, []);

  const fetchUserPlan = async () => {
    try {
      const res = await api.get("/users/me");
      setUserPlan(res.data.plan || "free");
    } catch {
      setUserPlan("free");
    }
  };

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

  const handleApplyNow = async (score: any) => {
    setActionId(score.id);
    try {
      // Create application from lead
      const createRes = await api.post(`/applications/from-lead/${score.job_lead_id}`);
      const applicationId = createRes.data.application_id;

      // Open job URL in new tab
      if (score.url) {
        window.open(score.url, "_blank");
      }

      // Mark as manual
      await api.post(`/applications/${applicationId}/mark-manual`);

      setAppliedIds((prev) => new Set(prev).add(score.id));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to apply");
    } finally {
      setActionId(null);
    }
  };

  const handleGetAIHelp = async (score: any) => {
    setGeneratingId(score.id);
    try {
      // Create application from lead
      const createRes = await api.post(`/applications/from-lead/${score.job_lead_id}`);
      const applicationId = createRes.data.application_id;

      // Generate cover letter
      const genRes = await api.post(`/applications/${applicationId}/generate-cover-letter`);
      setCoverLetterModal({
        ...genRes.data,
        url: score.url,
        title: score.job_title,
        company: score.company,
      });
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to generate cover letter");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleSkip = async (score: any) => {
    setActionId(score.id);
    try {
      await api.post("/job-scores/skip", { job_lead_id: score.job_lead_id });
      setScores((prev) => prev.filter((s) => s.id !== score.id));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to skip");
    } finally {
      setActionId(null);
    }
  };

  const isPro = userPlan === "pro" || userPlan === "premium" || userPlan === "enterprise";

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
          Matched job opportunities ready for your review.
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
                <h3 className="font-semibold text-foreground">
                  {score.job_title || "Job Lead"}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    score.fit_score >= 0.8
                      ? "bg-green-500/20 text-green-400"
                      : score.fit_score >= 0.6
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  Fit {Math.round(score.fit_score * 100)}%
                </span>
                {appliedIds.has(score.id) && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                    Applied ✅
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {score.company} {score.location ? `· ${score.location}` : ""}
              </p>
              {score.gap_notes && (
                <p className="text-xs text-muted-foreground mt-1">{score.gap_notes}</p>
              )}
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
                onClick={() => handleApplyNow(score)}
                disabled={actionId === score.id || generatingId === score.id || appliedIds.has(score.id)}
                className="px-3 py-2 bg-primary-500/20 text-primary-400 rounded-lg hover:bg-primary-500/30 transition-colors text-sm font-medium flex items-center gap-1 disabled:opacity-50"
              >
                {actionId === score.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                {appliedIds.has(score.id) ? "Applied" : "Apply Now"}
              </button>
              {isPro && (
                <button
                  onClick={() => handleGetAIHelp(score)}
                  disabled={actionId === score.id || generatingId === score.id}
                  className="px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                >
                  {generatingId === score.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Get AI Help
                </button>
              )}
              {!isPro && (
                <span className="px-2 py-2 text-xs text-muted-foreground/50 rounded-lg border border-border">
                  <Sparkles className="w-3 h-3 inline mr-1" />
                  Pro
                </span>
              )}
              <button
                onClick={() => handleSkip(score)}
                disabled={actionId === score.id || generatingId === score.id}
                className="px-3 py-2 bg-white/5 text-muted-foreground rounded-lg hover:bg-white/10 transition-colors text-sm font-medium flex items-center gap-1 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> Skip
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Cover Letter Modal */}
      {coverLetterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                AI Cover Letter — {coverLetterModal.title}
              </h3>
              <button
                onClick={() => setCoverLetterModal(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {coverLetterModal.cover_letter && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-400" />
                  <span className="text-sm font-medium text-foreground">Cover Letter</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(coverLetterModal.cover_letter)}
                    className="ml-auto text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
                <div className="p-3 bg-background border border-border rounded-lg text-sm text-foreground whitespace-pre-wrap">
                  {coverLetterModal.cover_letter}
                </div>
              </div>
            )}

            {coverLetterModal.answers && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-foreground">Suggested Answers</span>
                <div className="grid gap-2">
                  {Object.entries(coverLetterModal.answers).map(([key, value]: [string, any]) => (
                    <div key={key} className="p-3 bg-background border border-border rounded-lg">
                      <span className="text-xs font-medium text-muted-foreground uppercase">
                        {key.replace(/_/g, " ")}
                      </span>
                      <p className="text-sm text-foreground mt-1">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  if (coverLetterModal.url) window.open(coverLetterModal.url, "_blank");
                }}
                className="flex-1 px-4 py-2 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Open Application
              </button>
              <button
                onClick={() => setCoverLetterModal(null)}
                className="px-4 py-2 bg-white/5 text-foreground rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
