"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { applicationsAPI, type Application } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  approved: "bg-blue-500",
  submitted: "bg-green-500",
  failed: "bg-red-500",
  interview: "bg-purple-500",
  rejected: "bg-gray-500",
  accepted: "bg-emerald-500",
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    applicationsAPI.list()
      .then((data) => setApplications(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load applications"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
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
      <h1 className="text-3xl font-bold">Applications Pipeline</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {applications.map((app) => (
          <Card key={app.id}>
            <CardHeader>
              <CardTitle>{app.job.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{app.job.company}</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge className={STATUS_COLORS[app.status] || "bg-gray-500"}>
                  {app.status}
                </Badge>
              </div>
              {app.appliedAt && (
                <p className="text-sm text-muted-foreground mt-2">Applied: {app.appliedAt.slice(0, 10)}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {applications.length === 0 && (
        <p className="text-muted-foreground">No applications yet.</p>
      )}
    </div>
  );
}
