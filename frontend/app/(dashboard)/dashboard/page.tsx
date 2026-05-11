"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Briefcase, Search, CalendarCheck, TrendingUp, ArrowRight, Plus, ClipboardCheck } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import JobCard from "@/components/dashboard/JobCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useApplicationStream } from "@/hooks/useApplicationStream";
import { useSearchStream } from "@/hooks/useSearchStream";
import { useAuth } from "@/hooks/useAuth";

interface Overview {
  total_applications: number;
  total_jobs_discovered: number;
  counts_by_status: { status: string; count: number }[];
  success_rate: number;
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Realtime streams (replace one-time HTTP fetch for apps/searches)
  const { user } = useAuth();
  const { applications, loading: appsLoading } = useApplicationStream(user?.id || "");
  const { searches, loading: searchesLoading } = useSearchStream(user?.id || "");

  // Recent applications = latest 5 from realtime stream
  const recent = applications.slice(0, 5);
  const activeSearchCount = searches.filter((s) => s.is_active).length;

  // Load server-computed analytics (can't derive from client-side data)
  useEffect(() => {
    const loadOverview = async () => {
      try {
        const [ovRes, approvalRes] = await Promise.all([
          api.get("/analytics/overview"),
          api.get("/applications/approval-queue").catch(() => ({ data: [] })),
        ]);
        setOverview(ovRes.data);
        setPendingApprovalCount(Array.isArray(approvalRes.data) ? approvalRes.data.length : 0);
      } catch (e) {
        console.error("Dashboard load error:", e);
      } finally {
        setOverviewLoading(false);
      }
    };
    loadOverview();
  }, []);

  const todayCount = overview?.counts_by_status?.find(
    (c) => c.status === "submitted"
  )?.count || 0;
  const interviewCount = overview?.counts_by_status?.find(
    (c) => c.status === "interview"
  )?.count || 0;

  const loading = overviewLoading || appsLoading || searchesLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <Link href="/searches">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1" /> New Search
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Applications Submitted"
          value={todayCount}
          icon={Briefcase}
          iconColor="bg-blue-500/10 text-blue-400"
          change={`${overview?.total_applications || 0} total`}
          changeType="neutral"
        />
        <StatCard
          title="Active Searches"
          value={activeSearchCount}
          icon={Search}
          iconColor="bg-primary-500/10 text-primary-500"
          change="running now"
          changeType="neutral"
        />
        <StatCard
          title="Interviews"
          value={interviewCount}
          icon={CalendarCheck}
          iconColor="bg-green-500/10 text-green-400"
          change="scheduled"
          changeType="neutral"
        />
        <StatCard
          title="Pending Approval"
          value={pendingApprovalCount}
          icon={ClipboardCheck}
          iconColor="bg-orange-500/10 text-orange-400"
          change={pendingApprovalCount > 0 ? "needs review" : "all clear"}
          changeType={pendingApprovalCount > 0 ? "down" : "up"}
          href="/approval-queue"
        />
        <StatCard
          title="Success Rate"
          value={`${overview?.success_rate || 0}%`}
          icon={TrendingUp}
          iconColor="bg-amber-500/10 text-amber-400"
          change={overview?.success_rate && overview.success_rate > 10 ? "Good progress!" : "Keep going"}
          changeType={overview?.success_rate && overview.success_rate > 10 ? "up" : "neutral"}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/searches">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center">
                <Search className="w-5 h-5 text-primary-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Create Job Search</p>
                <p className="text-xs text-muted-foreground">Set up a new search criteria</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary-500 transition-colors" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/applications">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">View Applications</p>
                <p className="text-xs text-muted-foreground">Track all your applications</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-green-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/analytics">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">View Analytics</p>
                <p className="text-xs text-muted-foreground">Insights and trends</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-amber-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/approval-queue">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Approval Queue</p>
                <p className="text-xs text-muted-foreground">
                  {pendingApprovalCount > 0
                    ? `${pendingApprovalCount} awaiting review`
                    : "All caught up"}
                </p>
              </div>
              {pendingApprovalCount > 0 && (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">
                  {pendingApprovalCount}
                </span>
              )}
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-orange-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Applications (live via Supabase Realtime) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Applications</CardTitle>
          <Link href="/applications">
            <Button variant="ghost" size="sm">View all</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium">No applications yet</p>
              <p className="text-sm mt-1">Create a job search to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Job ID</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Approval</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Applied</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((app) => (
                    <tr key={app.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-2 font-mono text-xs text-foreground">{app.id.slice(0, 8)}…</td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          app.status === "submitted" ? "bg-blue-500/15 text-blue-400" :
                          app.status === "interview" ? "bg-green-500/15 text-green-400" :
                          app.status === "rejected" ? "bg-red-500/15 text-red-400" :
                          app.status === "failed" ? "bg-red-500/15 text-red-400" :
                          "bg-amber-500/15 text-amber-400"
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        {app.approval_status ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            app.approval_status === "pending_approval" ? "bg-orange-500/15 text-orange-400" :
                            app.approval_status === "approved" ? "bg-green-500/15 text-green-400" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {app.approval_status === "pending_approval" ? "awaiting" : app.approval_status}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">{app.applied_at ? formatDate(app.applied_at) : "—"}</td>
                      <td className="py-3 px-2 text-muted-foreground">{formatDate(app.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}