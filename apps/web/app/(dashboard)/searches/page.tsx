"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Globe, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SearchForm from "@/components/dashboard/SearchForm";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { jobSearchAPI, credentialsAPI, portalSessionsAPI, discoveryAPI, type PortalSession } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useRunStatus } from "@/hooks/useRunStatus";

interface JobSearchItem {
  id: string;
  name: string;
  platform: string;
  keywords: string;
  location: string | null;
  experienceLevel: string | null;
  jobType: string | null;
  remoteOnly: boolean;
  salaryMinLpa: number | null;
  salaryMaxLpa: number | null;
  isActive: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

function normalizeSearch(item: { id: string; name: string; platform: string; keywords: string; location?: string | null; experienceLevel?: string | null; jobType?: string | null; remoteOnly?: boolean; salaryMinLpa?: number | null; salaryMaxLpa?: number | null; isActive?: boolean; lastRunAt?: string | null; createdAt: string }): JobSearchItem {
  return {
    id: item.id,
    name: item.name,
    platform: item.platform,
    keywords: item.keywords,
    location: item.location ?? null,
    experienceLevel: item.experienceLevel ?? null,
    jobType: item.jobType ?? null,
    remoteOnly: item.remoteOnly ?? false,
    salaryMinLpa: item.salaryMinLpa ?? null,
    salaryMaxLpa: item.salaryMaxLpa ?? null,
    isActive: item.isActive ?? true,
    lastRunAt: item.lastRunAt ?? null,
    createdAt: item.createdAt,
  };
}

const platformColors: Record<string, string> = {
  linkedin: "bg-blue-500/15 text-blue-400",
  naukri: "bg-amber-500/15 text-amber-400",
  shine: "bg-orange-500/15 text-orange-400",
  unstop: "bg-purple-500/15 text-purple-400",
  wellfound: "bg-cyan-500/15 text-cyan-400",
  internshala: "bg-green-500/15 text-green-400",
  both: "bg-primary-500/15 text-primary-500",
};

export default function SearchesPage() {
  const [searches, setSearches] = useState<JobSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<JobSearchItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasConnections, setHasConnections] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [triggerMsgs, setTriggerMsgs] = useState<Record<string, string>>({});
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const { runStatus, isPolling } = useRunStatus(activeRunId);

  // Auto-clear stale run state after 3 minutes
  useEffect(() => {
    if (!activeRunId) return;
    const timeout = setTimeout(() => {
      setActiveRunId(null);
      setTriggerMsgs((m) => {
        const updated = { ...m };
        Object.keys(updated).forEach((k) => { updated[k] = ""; });
        return updated;
      });
    }, 3 * 60 * 1000);
    return () => clearTimeout(timeout);
  }, [activeRunId]);

  const fetchSearches = useCallback(async () => {
    try {
      const data = await jobSearchAPI.list();
      setSearches((data || []).map(normalizeSearch));
    } catch (e: unknown) {
      console.error(e);
      const err = e as { response?: { data?: { error?: string; detail?: string } } };
      setError(err.response?.data?.error || err.response?.data?.detail || "Failed to load searches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSearches();
  }, [fetchSearches]);

  useEffect(() => {
    const loadConnections = async () => {
      try {
        const [creds, portalRes] = await Promise.allSettled([
          credentialsAPI.list(),
          portalSessionsAPI.list(),
        ]);
        const hasCreds = creds.status === "fulfilled" && (creds.value || []).length > 0;
        const hasPortals =
          portalRes.status === "fulfilled" &&
          (portalRes.value?.sessions || []).some((s: PortalSession) => s.status === "active" || s.verified);
        setHasConnections(hasCreds || hasPortals);
      } catch {
        setHasConnections(false);
      }
    };
    loadConnections();
  }, []);

  const handleCreate = async (formData: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      if (editItem) {
        await jobSearchAPI.update(editItem.id, formData);
      } else {
        await jobSearchAPI.create(formData as never);
      }
      setDialogOpen(false);
      setEditItem(null);
      await fetchSearches();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; detail?: string } } };
      setError(err.response?.data?.error || err.response?.data?.detail || "Failed to save search");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this search?")) return;
    setError(null);
    try {
      await jobSearchAPI.delete(id);
      await fetchSearches();
    } catch (e: unknown) {
      console.error(e);
      const err = e as { response?: { data?: { error?: string; detail?: string } } };
      setError(err.response?.data?.error || err.response?.data?.detail || "Failed to delete");
    }
  };

  const handleToggle = async (search: JobSearchItem) => {
    setError(null);
    try {
      await jobSearchAPI.toggle(search.id, search.isActive);
      await fetchSearches();
    } catch (e: unknown) {
      console.error(e);
      const err = e as { response?: { data?: { error?: string; detail?: string } } };
      setError(err.response?.data?.error || err.response?.data?.detail || "Failed to toggle search");
    }
  };

  const openCreate = () => {
    setEditItem(null);
    setDialogOpen(true);
  };

  const openEdit = (s: JobSearchItem) => {
    setEditItem(s);
    setDialogOpen(true);
  };

  const handleTrigger = async (id: string) => {
    setRunning(id);
    setTriggerMsgs((m) => ({ ...m, [id]: "" }));
    setActiveRunId(null);
    try {
      const data = await discoveryAPI.runSearch(id);
      const taskId = data.taskId || null;
      // Fallback direct-scrape returns immediately with status "completed"
      if (data.status === "completed" || taskId?.startsWith("fallback-")) {
        setTriggerMsgs((m) => ({
          ...m,
          [id]: "✅ Discovery complete",
        }));
        setTimeout(() => setTriggerMsgs((m) => ({ ...m, [id]: "" })), 8000);
      } else if (taskId) {
        setActiveRunId(taskId);
        setTriggerMsgs((m) => ({ ...m, [id]: `🔍 Starting discovery...` }));
      } else {
        setTriggerMsgs((m) => ({ ...m, [id]: `✓ Discovery workflow queued!` }));
        setTimeout(() => setTriggerMsgs((m) => ({ ...m, [id]: "" })), 8000);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; detail?: string } } };
      setTriggerMsgs((m) => ({ ...m, [id]: err.response?.data?.error || err.response?.data?.detail || "Failed to trigger search" }));
    } finally {
      setRunning(null);
    }
  };

  const runStatusLabel = () => {
    if (!runStatus) return "";
    switch (runStatus.status) {
      case "queued":
        return "🔍 Starting discovery...";
      case "running":
        return "📋 Running workflow...";
      case "pending_approval":
        return `✅ ${runStatus.pending_approvals ?? 0} jobs sent to Approval Queue`;
      case "skipped":
        return "No matching jobs found. Try different keywords.";
      case "failed":
        return `❌ Discovery failed: ${runStatus.error || "Unknown error"}`;
      case "error":
        return `❌ Workflow error: ${runStatus.error || "Unknown error"}`;
      case "not_found":
        return "⏳ Waiting for workflow to start...";
      default:
        return `⏳ ${runStatus.status}...`;
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {!hasConnections && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
          <span className="text-amber-500 text-xl">⚠️</span>
          <div>
            <p className="font-medium text-amber-400">Auto-apply is not active</p>
            <p className="text-sm text-amber-400 mt-0.5">
              You haven&apos;t linked your LinkedIn or Naukri account yet.{" "}
              <a href="/portals" className="underline font-medium">Connect a portal</a> to enable automatic job applications.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Job Searches</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Add New Search
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editItem ? "Edit Search" : "New Job Search"}</DialogTitle>
            </DialogHeader>
            <SearchForm
              onSubmit={handleCreate}
              loading={saving}
              defaultValues={
                editItem
                  ? {
                      name: editItem.name,
                      platform: editItem.platform as "linkedin" | "naukri" | "shine" | "unstop" | "wellfound" | "internshala",
                      keywords: editItem.keywords,
                      location: editItem.location || "",
                      experience_level: editItem.experienceLevel || "",
                      remote_only: editItem.remoteOnly,
                      salary_min_lpa: editItem.salaryMinLpa?.toString() || "",
                      salary_max_lpa: editItem.salaryMaxLpa?.toString() || "",
                    }
                  : undefined
              }
            />
          </DialogContent>
        </Dialog>
      </div>

      {searches.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Globe className="w-12 h-12 text-muted-foreground/70 mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">No searches yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first job search to start discovering opportunities.</p>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Create Search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {searches.map((s) => (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">{s.name}</h3>
                      <Badge className={platformColors[s.platform] || "bg-muted text-muted-foreground"} variant="secondary">
                        {s.platform}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground mb-1">
                      <span className="font-medium">Keywords:</span> {s.keywords}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {s.location && <span>📍 {s.location}</span>}
                      {s.experienceLevel && <span>💼 {s.experienceLevel}</span>}
                      {s.remoteOnly && <span>🏠 Remote</span>}
                      {s.salaryMinLpa && <span>💰 ₹{s.salaryMinLpa}–{s.salaryMaxLpa || "?"} LPA</span>}
                      {s.lastRunAt && <span>🔄 Last run: {formatDate(s.lastRunAt)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={s.isActive} onCheckedChange={() => handleToggle(s)} />
                      <span className="text-xs text-muted-foreground">{s.isActive ? "Active" : "Paused"}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={running === s.id || !s.isActive}
                      onClick={() => handleTrigger(s.id)}
                      className="text-primary-500 border-primary-500/20 hover:bg-primary-500/10"
                    >
                      {running === s.id ? (
                        <span className="flex items-center gap-1">
                          <span className="animate-spin h-3 w-3 border-2 border-primary-500 border-t-transparent rounded-full" />
                          Running...
                        </span>
                      ) : (
                        "▶ Run Now"
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                    </Button>
                  </div>
                </div>
                {(isPolling || triggerMsgs[s.id]) && (
                  <div className={`mt-3 text-xs border rounded-lg p-2 ${
                    runStatus?.status === "pending_approval"
                      ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : runStatus?.status === "skipped" || runStatus?.status === "failed"
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : "bg-primary-500/10 text-primary-400 border-primary-500/20"
                  }`}>
                    <div className="flex items-center gap-2">
                      {isPolling && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>{runStatus ? runStatusLabel() : triggerMsgs[s.id]}</span>
                    </div>
                    {runStatus?.status === "pending_approval" && (
                      <Link
                        href="/approval-queue"
                        className="inline-flex items-center gap-1 mt-1 text-xs font-medium underline hover:text-green-300"
                      >
                        Review now <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
