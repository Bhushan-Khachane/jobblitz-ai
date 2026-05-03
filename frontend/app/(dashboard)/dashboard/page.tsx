"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Briefcase, Search, CalendarCheck, TrendingUp, ArrowRight, Plus } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import JobCard from "@/components/dashboard/JobCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface Overview {
  total_applications: number;
  total_jobs_discovered: number;
  counts_by_status: { status: string; count: number }[];
  success_rate: number;
}

interface Application {
  id: string;
  job_listing_id: string;
  status: string;
  applied_at: string | null;
  created_at: string;
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [recent, setRecent] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [ovRes, appsRes] = await Promise.all([
          api.get("/analytics/overview"),
          api.get("/applications/", { params: { page: 1, page_size: 5 } }),
        ]);
        setOverview(ovRes.data);
        setRecent(appsRes.data.items || []);
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const todayCount = overview?.counts_by_status?.find(
    (c) => c.status === "submitted"
  )?.count || 0;
  const interviewCount = overview?.counts_by_status?.find(
    (c) => c.status === "interview"
  )?.count || 0;

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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link href="/searches">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1" /> New Search
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Applications Submitted"
          value={todayCount}
          icon={Briefcase}
          iconColor="bg-blue-50 text-blue-600"
          change={`${overview?.total_applications || 0} total`}
          changeType="neutral"
        />
        <StatCard
          title="Active Searches"
          value={overview?.total_jobs_discovered || 0}
          icon={Search}
          iconColor="bg-purple-50 text-purple-600"
          change="jobs discovered"
          changeType="neutral"
        />
        <StatCard
          title="Interviews"
          value={interviewCount}
          icon={CalendarCheck}
          iconColor="bg-green-50 text-green-600"
          change="scheduled"
          changeType="neutral"
        />
        <StatCard
          title="Success Rate"
          value={`${overview?.success_rate || 0}%`}
          icon={TrendingUp}
          iconColor="bg-amber-50 text-amber-600"
          change={overview?.success_rate && overview.success_rate > 10 ? "Good progress!" : "Keep going"}
          changeType={overview?.success_rate && overview.success_rate > 10 ? "up" : "neutral"}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/searches">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                <Search className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Create Job Search</p>
                <p className="text-xs text-gray-500">Set up a new search criteria</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/applications">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">View Applications</p>
                <p className="text-xs text-gray-500">Track all your applications</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/analytics">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">View Analytics</p>
                <p className="text-xs text-gray-500">Insights and trends</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Applications */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Applications</CardTitle>
          <Link href="/applications">
            <Button variant="ghost" size="sm">View all</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Briefcase className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No applications yet</p>
              <p className="text-sm mt-1">Create a job search to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Job ID</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Applied</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((app) => (
                    <tr key={app.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-2 font-mono text-xs text-gray-700">{app.id.slice(0, 8)}…</td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          app.status === "submitted" ? "bg-blue-100 text-blue-700" :
                          app.status === "interview" ? "bg-green-100 text-green-700" :
                          app.status === "rejected" ? "bg-red-100 text-red-700" :
                          app.status === "failed" ? "bg-red-100 text-red-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-gray-600">{app.applied_at ? formatDate(app.applied_at) : "—"}</td>
                      <td className="py-3 px-2 text-gray-600">{formatDate(app.created_at)}</td>
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
