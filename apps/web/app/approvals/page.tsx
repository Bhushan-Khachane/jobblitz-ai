"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { approvalsAPI, type Approval } from "@/lib/api";

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    approvalsAPI.list()
      .then((data) => setApprovals(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load approvals"))
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await approvalsAPI.approve(id);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await approvalsAPI.reject(id);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
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
      <h1 className="text-3xl font-bold">Approval Queue</h1>
      {approvals.length === 0 ? (
        <p className="text-muted-foreground">No pending approvals.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {approvals.map((approval) => (
            <Card key={approval.id}>
              <CardHeader>
                <CardTitle>{approval.job.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{approval.job.company}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge>Match: {approval.fitScore ?? 0}%</Badge>
                {approval.reason && <p className="text-sm">{approval.reason}</p>}
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button onClick={() => handleApprove(approval.id)} className="flex-1">
                  Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleReject(approval.id)}
                  className="flex-1"
                >
                  Reject
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
