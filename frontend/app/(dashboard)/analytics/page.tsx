"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Clock, Target } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import StatCard from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";

interface Overview {
  total_applications: number;
  total_jobs_discovered: number;
  counts_by_status: { status: string; count: number }[];
  success_rate: number;
}

interface DailyStat {
  date: string;
  applications: number;
  discoveries: number;
}

const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [daily, setDaily] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [ovRes, dailyRes] = await Promise.all([
          api.get("/analytics/overview"),
          api.get("/analytics/daily-stats", { params: { days: 30 } }),
        ]);
        setOverview(ovRes.data);
        setDaily(dailyRes.data.stats || []);
      } catch {
        // use defaults
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const statusData = (overview?.counts_by_status || []).map((s) => ({
    name: s.status.charAt(0).toUpperCase() + s.status.slice(1),
    value: s.count,
  }));

  // Platform breakdown from daily data (mock split: 60% linkedin, 40% naukri)
  const platformData = [
    { name: "LinkedIn", value: Math.round((overview?.total_applications || 0) * 0.6) },
    { name: "Naukri", value: Math.round((overview?.total_applications || 0) * 0.4) },
  ];

  const totalApplied = overview?.total_applications || 0;
  const interviewCount = overview?.counts_by_status?.find((c) => c.status === "interview")?.count || 0;
  const responseRate = totalApplied > 0 ? ((interviewCount / totalApplied) * 100).toFixed(1) : "0";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Analytics</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Applied"
          value={totalApplied}
          icon={BarChart3}
          iconColor="bg-primary-500/10 text-primary-500"
          change={`${overview?.total_jobs_discovered || 0} jobs discovered`}
          changeType="neutral"
        />
        <StatCard
          title="Response Rate"
          value={`${responseRate}%`}
          icon={Target}
          iconColor="bg-green-500/10 text-green-600"
          change={`${interviewCount} interviews`}
          changeType="up"
        />
        <StatCard
          title="Success Rate"
          value={`${overview?.success_rate || 0}%`}
          icon={TrendingUp}
          iconColor="bg-amber-500/10 text-amber-600"
          change="submitted / total"
          changeType="neutral"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart: Applications over time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Applications Over Time (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {daily.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground/70 text-sm">
                No data yet. Start applying to see trends.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="applications" stroke="#4f46e5" strokeWidth={2} dot={false} name="Applications" />
                  <Line type="monotone" dataKey="discoveries" stroke="#10b981" strokeWidth={2} dot={false} name="Discoveries" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart: By platform */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Applications by Platform</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={platformData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} name="Applications" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart: Status breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground/70 text-sm">
                No applications yet.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {statusData.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground">{s.name}</span>
                      <span className="font-semibold text-foreground ml-auto">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
