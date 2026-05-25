"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface EmployerResearch {
  id: string;
  name: string;
  industry: string;
  size: string;
  techStack: string[];
  reputationScore: number;
  lastResearchedAt: string;
}

export default function ResearchPage() {
  const [search, setSearch] = useState("");
  const [employers] = useState<EmployerResearch[]>([
    {
      id: "1",
      name: "TechCorp",
      industry: "Software",
      size: "1000+",
      techStack: ["Python", "React", "AWS", "Kubernetes"],
      reputationScore: 4.2,
      lastResearchedAt: "2026-05-24",
    },
    {
      id: "2",
      name: "StartupX",
      industry: "Fintech",
      size: "50-200",
      techStack: ["TypeScript", "Node.js", "PostgreSQL"],
      reputationScore: 3.8,
      lastResearchedAt: "2026-05-23",
    },
  ]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Company Intelligence</h1>
      <div className="flex gap-2 max-w-md">
        <Input
          placeholder="Search company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button>Research</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {employers.map((emp) => (
          <Card key={emp.id}>
            <CardHeader>
              <CardTitle>{emp.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {emp.industry} · {emp.size}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {emp.techStack.map((tech) => (
                  <Badge key={tech} variant="outline">{tech}</Badge>
                ))}
              </div>
              <p className="text-sm">Reputation: {emp.reputationScore}/5</p>
              <p className="text-xs text-muted-foreground">
                Last updated: {emp.lastResearchedAt}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
