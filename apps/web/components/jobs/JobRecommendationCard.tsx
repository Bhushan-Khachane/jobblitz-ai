"use client";

import { ExternalLink, X, Briefcase, MapPin, DollarSign, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { jobsAPI } from "@/lib/api";
import type { Job } from "@/lib/api";

interface Props {
  job: Job;
  onDismiss: (jobId: string) => void;
  onApply: (jobId: string) => void;
}

function tierBadge(matchScore: number | null) {
  if (!matchScore) return null;
  let tier: string;
  let style: string;
  if (matchScore >= 90) {
    tier = "Apply Now";
    style = "bg-red-500/20 text-red-400 border-red-500/30";
  } else if (matchScore >= 75) {
    tier = "Strong Fit";
    style = "bg-green-500/20 text-green-400 border-green-500/30";
  } else {
    tier = "Consider";
    style = "bg-amber-500/20 text-amber-400 border-amber-500/30";
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${style}`}>
      {tier}
    </span>
  );
}

function scoreColor(score: number | null) {
  if (score == null) return "text-gray-400";
  if (score >= 90) return "text-green-400";
  if (score >= 75) return "text-amber-400";
  return "text-red-400";
}

function scoreRingColor(score: number | null) {
  if (score == null) return "stroke-gray-400";
  if (score >= 90) return "stroke-green-400";
  if (score >= 75) return "stroke-amber-400";
  return "stroke-red-400";
}

export default function JobRecommendationCard({ job, onDismiss, onApply }: Props) {
  const handleApply = async () => {
    try {
      await jobsAPI.apply(job.id);
      onApply(job.id);
    } catch {
      alert("Failed to queue application");
    }
  };

  const handleDismiss = async () => {
    try {
      await jobsAPI.dismiss(job.id);
      onDismiss(job.id);
    } catch {
      alert("Failed to dismiss");
    }
  };

  const explanation = job.matchExplanation as Record<string, unknown> | null;
  const matched = (explanation?.matched as string[]) || [];
  const missing = (explanation?.missing as string[]) || [];
  const score = job.matchScore ?? 0;

  return (
    <Card className="relative overflow-hidden border-white/5 hover:border-white/10 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white/90 truncate">{job.title || "Untitled Role"}</h3>
              {tierBadge(job.matchScore ?? null)}
            </div>
            <p className="text-sm text-white/50 mt-0.5">{job.company || "Unknown Company"}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Score ring */}
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="stroke-white/10"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  strokeWidth="3"
                />
                <path
                  className={scoreRingColor(job.matchScore ?? null)}
                  strokeDasharray={`${score}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <span className={`absolute text-xs font-bold ${scoreColor(job.matchScore ?? null)}`}>
                {score}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Meta row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {job.location}
            </span>
          )}
          {job.jobType && (
            <span className="flex items-center gap-1">
              <Briefcase className="w-3 h-3" />
              {job.jobType}
            </span>
          )}
          {job.yearsExperienceMin != null && (
            <span className="flex items-center gap-1">
              <Award className="w-3 h-3" />
              {job.yearsExperienceMin}+ years
            </span>
          )}
          {job.salaryMinLpa != null && job.salaryMaxLpa != null && (
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {job.salaryMinLpa}-{job.salaryMaxLpa} LPA
            </span>
          )}
        </div>

        {/* Skills */}
        <div className="space-y-2">
          {matched.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {matched.slice(0, 8).map((s) => (
                <span key={s} className="text-[10px] px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full">
                  {s}
                </span>
              ))}
            </div>
          )}
          {missing.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {missing.slice(0, 5).map((s) => (
                <span key={s} className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-400 rounded-full">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {job.applyUrl && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1"
              onClick={() => window.open(job.applyUrl!, "_blank")}
            >
              <ExternalLink className="w-3 h-3" />
              View Job
            </Button>
          )}
          <Button size="sm" variant="default" className="text-xs" onClick={handleApply}>
            Apply Now
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-white/30 hover:text-red-400 ml-auto"
            onClick={handleDismiss}
          >
            <X className="w-3 h-3" />
            Dismiss
          </Button>
        </div>

        <p className="text-[10px] text-white/20">
          Source: {job.platform || "unknown"} · Discovered{" "}
          {new Date(job.createdAt).toLocaleDateString("en-IN")}
        </p>
      </CardContent>
    </Card>
  );
}
