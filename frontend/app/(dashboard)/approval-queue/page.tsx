"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Clock, Building2, MapPin, ExternalLink, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useApprovalQueue } from "@/hooks/useApprovalQueue";
import { formatDate, getPlatformBadgeColor } from "@/lib/utils";

interface QueueItem {
  id: string;
  job_listing_id: string;
  job_title: string | null;
  company: string | null;
  location: string | null;
  portal: string | null;
  apply_url: string | null;
  fit_score: number | null;
  gap_notes: string | null;
  created_at: string;
  answers_used?: Record<string, any> | null;
}

export default function ApprovalQueuePage() {
  const { queue, loading, error, refetch, approve, reject, answerQuestions } = useApprovalQueue();
  const [acting, setActing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pendingAnswers, setPendingAnswers] = useState<Record<string, Record<string, string>>>({});

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  const handleApprove = async (id: string) => {
    setActing(id);
    try {
      await approve(id);
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id: string) => {
    setActing(id);
    try {
      await reject(id);
    } finally {
      setActing(null);
    }
  };

  const handleAnswerChange = (id: string, question: string, value: string) => {
    setPendingAnswers((prev) => ({
      ...prev,
      [id]: { ...prev[id], [question]: value },
    }));
  };

  const handleSaveAnswers = async (id: string) => {
    const answers = Object.entries(pendingAnswers[id] || {})
      .filter(([_, v]) => v.trim())
      .map(([question, answer]) => ({ question, answer }));
    if (answers.length === 0) return;
    setActing(id);
    try {
      await answerQuestions(id, answers);
    } finally {
      setActing(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <XCircle className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-muted-foreground font-medium">Failed to load approval queue</p>
        <p className="text-sm text-muted-foreground/70 mt-1">{error}</p>
        <Button variant="outline" className="mt-4" onClick={refetch}>
          Retry
        </Button>
      </div>
    );
  }

  const items = (queue || []) as QueueItem[];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Approval Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve job applications before they are submitted
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refetch}>
            Refresh
          </Button>
          <Badge variant="secondary" className="text-sm">
            {items.length} pending
          </Badge>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <CheckCircle className="w-16 h-16 text-green-300 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">All caught up!</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            No jobs pending approval. Run a job search to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {items.map((item) => {
              const isActing = acting === item.id;
              const isExpanded = expanded === item.id;
              const score = Math.round((item.fit_score ?? 0) * 100);
              const unanswered = item.answers_used?.unanswered || [];

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        {/* Job info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground truncate">
                              {item.job_title || "Unknown Position"}
                            </h3>
                            <Badge
                              variant="outline"
                              className={`text-[10px] shrink-0 ${getPlatformBadgeColor(item.portal || "")}`}
                            >
                              {item.portal || "—"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {item.company && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5" />
                                {item.company}
                              </span>
                            )}
                            {item.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {item.location}
                              </span>
                            )}
                          </div>

                          {/* Fit score */}
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 max-w-32 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  score >= 80
                                    ? "bg-green-500"
                                    : score >= 60
                                      ? "bg-yellow-500"
                                      : "bg-red-400"
                                }`}
                                style={{ width: `${Math.min(score, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground font-medium">
                              {score}% match
                            </span>
                          </div>

                          {/* Gap notes expandable */}
                          {item.gap_notes && (
                            <div className="mt-2">
                              <button
                                onClick={() => setExpanded(isExpanded ? null : item.id)}
                                className="flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-muted-foreground"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-3 h-3" /> Hide gap notes
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3 h-3" /> Show gap notes
                                  </>
                                )}
                              </button>
                              {isExpanded && (
                                <p className="text-xs text-muted-foreground/70 mt-1 bg-muted/50 rounded p-2">
                                  {item.gap_notes}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Queued date */}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mt-2">
                            <Clock className="w-3 h-3" />
                            <span>Queued {formatDate(item.created_at)}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 shrink-0">
                          {/* If there are unanswered questions, show answer inputs */}
                          {unanswered.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              <p className="text-xs text-amber-400 font-medium">
                                {unanswered.length} question(s) need your answer
                              </p>
                              {unanswered.map((q: string, idx: number) => (
                                <div key={idx} className="flex flex-col gap-1">
                                  <label className="text-[10px] text-muted-foreground truncate max-w-40" title={q}>
                                    {q.length > 40 ? q.slice(0, 40) + "..." : q}
                                  </label>
                                  <Input
                                    size={1}
                                    className="h-7 text-xs bg-background"
                                    placeholder="Your answer..."
                                    value={pendingAnswers[item.id]?.[q] || ""}
                                    onChange={(e) => handleAnswerChange(item.id, q, e.target.value)}
                                  />
                                </div>
                              ))}
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white mt-1"
                                disabled={isActing}
                                onClick={() => handleSaveAnswers(item.id)}
                              >
                                {isActing ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                                Save Answers & Apply
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              disabled={isActing}
                              onClick={() => handleApprove(item.id)}
                            >
                              {isActing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                              Approve
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-400 border-red-500/20 hover:bg-red-500/10"
                            disabled={isActing}
                            onClick={() => handleReject(item.id)}
                          >
                            {isActing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            Skip
                          </Button>
                          {item.apply_url && (
                            <a
                              href={item.apply_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary-500 hover:text-primary-500 text-center"
                            >
                              <ExternalLink className="w-3 h-3 inline mr-0.5" />
                              View job
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
