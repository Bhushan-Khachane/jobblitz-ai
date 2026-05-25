"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ApprovalRequest {
  id: string;
  jobTitle: string;
  company: string;
  fitScore: number;
  reason: string;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([
    {
      id: "1",
      jobTitle: "Staff Engineer",
      company: "BigTech",
      fitScore: 0.88,
      reason: "Strong skill match, salary within range, preferred location",
    },
    {
      id: "2",
      jobTitle: "Platform Engineer",
      company: "ScaleUp",
      fitScore: 0.72,
      reason: "Good match but missing Kubernetes experience",
    },
  ]);

  const handleApprove = (id: string) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
  };

  const handleReject = (id: string) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
  };

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
                <CardTitle>{approval.jobTitle}</CardTitle>
                <p className="text-sm text-muted-foreground">{approval.company}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge>Match: {Math.round(approval.fitScore * 100)}%</Badge>
                <p className="text-sm">{approval.reason}</p>
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
