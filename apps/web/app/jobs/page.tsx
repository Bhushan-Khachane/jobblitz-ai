"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { jobsAPI, type Job } from "@/lib/api";

export default function JobsPage() {
  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    jobsAPI.list()
      .then((data) => setJobs(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load jobs"))
      .finally(() => setLoading(false));
  }, []);

  const filteredJobs = jobs.filter(
    (job) =>
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.company.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
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
              <p className="text-sm text-muted-foreground">{job.company} · {job.location ?? "Remote"}</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(job.skillsRequired ?? []).map((skill) => (
                  <Badge key={skill} variant="secondary">{skill}</Badge>
                ))}
              </div>
              {job.salaryMinLpa != null && job.salaryMaxLpa != null && (
                <p className="mt-2 text-sm">
                  {job.salaryMinLpa} - {job.salaryMaxLpa} LPA
                </p>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Badge
                variant={job.matchScore != null && job.matchScore >= 80 ? "default" : "outline"}
              >
                Match: {job.matchScore ?? 0}%
              </Badge>
              <Button size="sm">Apply</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      {filteredJobs.length === 0 && (
        <p className="text-muted-foreground">No jobs found.</p>
      )}
    </div>
  );
}
