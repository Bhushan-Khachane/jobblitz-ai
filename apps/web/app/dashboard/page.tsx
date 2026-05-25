"use client";

import { ApprovalModal } from "@/components/ApprovalModal";
import type { ApprovalPayload } from "@/components/ApprovalModal";
import { LiveActivityFeed } from "@/components/LiveActivityFeed";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { PlanLimitToast } from "@/components/PlanLimitToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSSE } from "@/hooks/useSSE";
import { dashboardAPI } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function DashboardPage() {
  const [stats, setStats] = useState<{
    totalJobs: number;
    totalApplications: number;
    pendingApprovals: number;
    avgMatchScore: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvalPayload, setApprovalPayload] =
    useState<ApprovalPayload | null>(null);

  const { events, connected } = useSSE("/api/dashboard/stream");

  useEffect(() => {
    dashboardAPI
      .stats()
      .then((data) => setStats(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load stats"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    for (const evt of events) {
      if (evt.event === "approval") {
        const data = evt.data;
        setApprovalPayload({
          applicationId: String(
            data.applicationId ?? data.application_id ?? "",
          ),
          jobId: String(data.jobId ?? data.job_id ?? ""),
          jobTitle: String(data.jobTitle ?? data.title ?? "Unknown Job"),
          company: String(data.company ?? "Unknown Company"),
          matchScore:
            typeof data.matchScore === "number" ? data.matchScore : undefined,
          resumePreview:
            typeof data.resumePreview === "string"
              ? data.resumePreview
              : undefined,
          expiresAt:
            typeof data.expiresAt === "string" ? data.expiresAt : undefined,
        });
      }
    }
  }, [events]);

  const handleApprovalAction = () => {
    setApprovalPayload(null);
    // Refresh stats after approval action
    dashboardAPI
      .stats()
      .then((data) => setStats(data))
      .catch(() => {});
  };

  const pendingCount = useMemo(() => {
    return events.filter(
      (e) => e.event === "approval" || e.event === "approval_required",
    ).length;
  }, [events]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <OnboardingBanner />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`}
          />
          <span className="text-sm text-muted-foreground">
            {connected ? "Live" : "Reconnecting..."}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Jobs Discovered</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats?.totalJobs ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {stats?.totalApplications ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pending Approvals</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {pendingCount > 0
                    ? pendingCount
                    : (stats?.pendingApprovals ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Avg Match Score</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {stats?.avgMatchScore ?? 0}%
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-1 h-[calc(100vh-12rem)]">
          <Card className="h-full overflow-hidden">
            <LiveActivityFeed events={events} />
          </Card>
        </div>
      </div>

      <ApprovalModal
        payload={approvalPayload}
        onClose={() => setApprovalPayload(null)}
        onAction={handleApprovalAction}
      />

      <PlanLimitToast />
    </div>
  );
}
