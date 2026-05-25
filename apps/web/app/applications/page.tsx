"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Application {
  id: string;
  jobTitle: string;
  company: string;
  status: string;
  appliedAt: string;
}

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
  const [applications] = useState<Application[]>([
    {
      id: "1",
      jobTitle: "Senior Backend Engineer",
      company: "TechCorp",
      status: "submitted",
      appliedAt: "2026-05-20",
    },
    {
      id: "2",
      jobTitle: "Full Stack Developer",
      company: "StartupX",
      status: "interview",
      appliedAt: "2026-05-18",
    },
    {
      id: "3",
      jobTitle: "DevOps Engineer",
      company: "CloudOps",
      status: "pending",
      appliedAt: "2026-05-22",
    },
  ]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Applications Pipeline</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {applications.map((app) => (
          <Card key={app.id}>
            <CardHeader>
              <CardTitle>{app.jobTitle}</CardTitle>
              <p className="text-sm text-muted-foreground">{app.company}</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge className={STATUS_COLORS[app.status] || "bg-gray-500"}>
                  {app.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Applied: {app.appliedAt}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
