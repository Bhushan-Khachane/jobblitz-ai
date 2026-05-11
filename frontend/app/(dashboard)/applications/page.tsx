"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Briefcase, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import KanbanColumn from "@/components/dashboard/KanbanColumn";
import JobCard from "@/components/dashboard/JobCard";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useApplications, type Application } from "@/hooks/useApplications";
import api from "@/lib/api";

const columns = [
  { key: "pending", label: "Pending", variant: "warning" as const, icon: Clock },
  { key: "submitted", label: "Applied", variant: "default" as const, icon: Briefcase },
  { key: "interview", label: "Interview", variant: "success" as const, icon: CheckCircle },
  { key: "rejected", label: "Rejected", variant: "destructive" as const, icon: XCircle },
];

export default function ApplicationsPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [listings, setListings] = useState<Record<string, any>>({});
  const { applications, loading, refetch } = useApplications({
    status: filter === "all" ? undefined : filter,
    pageSize: 100,
  });

  // Fetch job listings for display
  useEffect(() => {
    const loadListings = async () => {
      try {
        const { data } = await api.get("/job-listings/", { params: { page_size: 100 } });
        const map: Record<string, any> = {};
        (data.items || []).forEach((l: any) => {
          map[l.id] = l;
        });
        setListings(map);
      } catch {
        // ignore
      }
    };
    loadListings();
  }, []);

  const filteredApps = applications.filter((app) => {
    if (!search) return true;
    const listing = listings[app.job_listing_id];
    if (!listing) return true;
    const q = search.toLowerCase();
    return (
      listing.title?.toLowerCase().includes(q) ||
      listing.company?.toLowerCase().includes(q)
    );
  });

  const getByStatus = (status: string) =>
    filteredApps.filter((a) => a.status === status || (status === "submitted" && a.status === "applied"));

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Applications</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
            <Input
              placeholder="Search by company or title..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All ({applications.length})</TabsTrigger>
          {columns.map((col) => {
            const count = applications.filter(
              (a) => a.status === col.key || (col.key === "submitted" && a.status === "applied")
            ).length;
            return (
              <TabsTrigger key={col.key} value={col.key}>
                {col.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Kanban view */}
      {filter === "all" ? (
        <div className="flex gap-6 overflow-x-auto pb-4">
          {columns.map((col) => {
            const apps = getByStatus(col.key);
            return (
              <KanbanColumn key={col.key} title={col.label} count={apps.length} variant={col.variant}>
                {apps.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground/70 bg-muted rounded-lg">
                    No {col.label.toLowerCase()} applications
                  </div>
                ) : (
                  apps.map((app) => {
                    const listing = listings[app.job_listing_id];
                    return (
                      <JobCard
                        key={app.id}
                        title={listing?.title || "Unknown Position"}
                        company={listing?.company || "Unknown"}
                        location={listing?.location}
                        platform={listing?.platform || "—"}
                        appliedDate={app.applied_at || undefined}
                        status={app.status}
                        approvalStatus={app.approval_status}
                      />
                    );
                  })
                )}
              </KanbanColumn>
            );
          })}
        </div>
      ) : (
        /* List view for filtered */
        <div className="grid gap-3">
          {filteredApps.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Briefcase className="w-12 h-12 text-muted-foreground/70 mx-auto mb-3" />
              <p className="font-medium">No applications found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            filteredApps.map((app) => {
              const listing = listings[app.job_listing_id];
              return (
                <JobCard
                  key={app.id}
                  title={listing?.title || "Unknown Position"}
                  company={listing?.company || "Unknown"}
                  location={listing?.location}
                  platform={listing?.platform || "—"}
                  appliedDate={app.applied_at || undefined}
                  status={app.status}
                />
              );
            })
          )}
        </div>
      )}
    </motion.div>
  );
}
