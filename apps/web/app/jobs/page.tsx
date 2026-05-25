"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salaryMinLpa: number | null;
  salaryMaxLpa: number | null;
  matchScore: number | null;
  status: string;
  skillsRequired: string[];
}

export default function JobsPage() {
  const [search, setSearch] = useState("");
  const [jobs] = useState<Job[]>([
    {
      id: "1",
      title: "Senior Software Engineer",
      company: "TechCorp",
      location: "Bangalore",
      salaryMinLpa: 25,
      salaryMaxLpa: 40,
      matchScore: 0.92,
      status: "discovered",
      skillsRequired: ["Python", "Django", "PostgreSQL"],
    },
    {
      id: "2",
      title: "Full Stack Developer",
      company: "StartupX",
      location: "Remote",
      salaryMinLpa: 20,
      salaryMaxLpa: 35,
      matchScore: 0.78,
      status: "scored",
      skillsRequired: ["React", "Node.js", "TypeScript"],
    },
  ]);

  const filteredJobs = jobs.filter(
    (job) =>
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Jobs Feed</h1>
      <Input
        placeholder="Search jobs..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredJobs.map((job) => (
          <Card key={job.id}>
            <CardHeader>
              <CardTitle>{job.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{job.company} · {job.location}</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {job.skillsRequired.map((skill) => (
                  <Badge key={skill} variant="secondary">{skill}</Badge>
                ))}
              </div>
              {job.salaryMinLpa && job.salaryMaxLpa && (
                <p className="mt-2 text-sm">
                  ₹{job.salaryMinLpa} - ₹{job.salaryMaxLpa} LPA
                </p>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Badge
                variant={job.matchScore && job.matchScore >= 0.8 ? "default" : "outline"}
              >
                Match: {Math.round((job.matchScore || 0) * 100)}%
              </Badge>
              <Button size="sm">Apply</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
