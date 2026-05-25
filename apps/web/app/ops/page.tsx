"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import api from "@/lib/api";

interface OpsMetrics {
  queueDepths: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  applicationsToday: number;
  avgMatchScore: number;
  llmCallsLastHour: number;
  activeBrowserSessions: number;
  recentErrors: Array<{ message: string; timestamp: string; service: string }>;
}

export default function OpsDashboard() {
  const [metrics, setMetrics] = useState<OpsMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { data } = await api.get<OpsMetrics>("/api/ops/metrics");
        setMetrics(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load metrics";
        setError(message);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Operations Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Queue Waiting</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics?.queueDepths.waiting ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Queue Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics?.queueDepths.active ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completed Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics?.queueDepths.completed ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-500">{metrics?.queueDepths.failed ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Apps Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics?.applicationsToday ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avg Match Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics?.avgMatchScore ?? "—"}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>LLM Calls / Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics?.llmCallsLastHour ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Browser Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics?.activeBrowserSessions ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Errors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {metrics?.recentErrors && metrics.recentErrors.length > 0 ? (
              metrics.recentErrors.map((err, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded bg-red-50 border border-red-100"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">{err.service}</Badge>
                    <span className="text-sm text-red-700 truncate max-w-md">{err.message}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(err.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No recent errors</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
