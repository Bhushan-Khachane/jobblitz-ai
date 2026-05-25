"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardAPI } from "@/lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState<{ totalJobs: number; totalApplications: number; pendingApprovals: number; avgMatchScore: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardAPI.stats()
      .then((data) => setStats(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

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
      <h1 className="text-3xl font-bold">Dashboard</h1>
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
            <p className="text-3xl font-bold">{stats?.totalApplications ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.pendingApprovals ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Avg Match Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.avgMatchScore ?? 0}%</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
