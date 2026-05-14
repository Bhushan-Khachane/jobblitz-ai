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
import api, { jobSearchAPI, credentialsAPI, discoveryAPI } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useRunStatus } from "@/hooks/useRunStatus";

interface JobSearch {
  id: string;
  name: string;
  platform: string;
  keywords: string;
  location: string | null;
  experience_level: string | null;
  job_type: string | null;
  remote_only: boolean;
  salary_min_lpa: number | null;
  salary_max_lpa: number | null;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
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
  const [searches, setSearches] = useState<JobSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<JobSearch | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(true);
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
      setSearches(data || []);
    } catch (e: any) {
      console.error(e);
      setError(e.response?.data?.detail || "Failed to load searches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSearches();
  }, [fetchSearches]);

  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const creds = await credentialsAPI.list();
        setHasCredentials((creds || []).length > 0);
      } catch (e: any) {
        console.error(e);
        setHasCredentials(false);
      }
    };
    loadCredentials();
  }, []);

  const handleCreate = async (formData: any) => {
    setSaving(true);
    setError(null);
    try {
      if (editItem) {
        await jobSearchAPI.update(editItem.id, formData);
      } else {
        await jobSearchAPI.create(formData);
      }
      setDialogOpen(false);
      setEditItem(null);
      await fetchSearches();
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || "Failed to save search");
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
    } catch (e: any) {
      console.error(e);
      setError(e.response?.data?.detail || "Failed to delete");
    }
  };

  const handleToggle = async (search: JobSearch) => {
    setError(null);
    try {
      await jobSearchAPI.toggle(search.id, search.is_active);
      await fetchSearches();
    } catch (e: any) {
      console.error(e);
      setError(e.response?.data?.detail || "Failed to toggle search");
    }
  };

  const openCreate = () => {
    setEditItem(null);
    setDialogOpen(true);
  };

  const openEdit = (s: JobSearch) => {
    setEditItem(s);
    setDialogOpen(true);
  };

  const handleTrigger = async (id: string) => {
    setRunning(id);
    setTriggerMsgs((m) => ({ ...m, [id]: "" }));
    setActiveRunId(null);
    try {
      const data = await discoveryAPI.runSearch(id);
      const runId = data.run_id || null;
      if (runId) {
        setActiveRunId(runId);
        setTriggerMsgs((m) => ({ ...m, [id]: `🔍 Starting discovery...` }));
      } else {
        setTriggerMsgs((m) => ({ ...m, [id]: `✓ Discovery workflow queued!` }));
        setTimeout(() => setTriggerMsgs((m) => ({ ...m, [id]: "" })), 8000);
      }
    } catch (e: any) {
      setTriggerMsgs((m) => ({ ...m, [id]: e.response?.data?.detail || "Failed to trigger search" }));
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
        return `Discovery failed: ${runStatus.error || "Unknown error"}`;
      default:
        return "";
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {!hasCredentials && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
          <span className="text-amber-500 text-xl">⚠️</span>
          <div>
            <p className="font-medium text-amber-400">Auto-apply is not active</p>
            <p className="text-sm text-amber-400 mt-0.5">
              You haven't linked your LinkedIn or Naukri account yet.{" "}
              <a href="/profile" className="underline font-medium">Add credentials</a> to enable automatic job applications.
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
                      platform: editItem.platform as any,
                      keywords: editItem.keywords,
                      location: editItem.location || "",
                      experience_level: editItem.experience_level || "",
                      remote_only: editItem.remote_only,
                      salary_min_lpa: editItem.salary_min_lpa?.toString() || "",
                      salary_max_lpa: editItem.salary_max_lpa?.toString() || "",
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
                      {s.experience_level && <span>💼 {s.experience_level}</span>}
                      {s.remote_only && <span>🏠 Remote</span>}
                      {s.salary_min_lpa && <span>💰 ₹{s.salary_min_lpa}–{s.salary_max_lpa || "?"} LPA</span>}
                      {s.last_run_at && <span>🔄 Last run: {formatDate(s.last_run_at)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={s.is_active} onCheckedChange={() => handleToggle(s)} />
                      <span className="text-xs text-muted-foreground">{s.is_active ? "Active" : "Paused"}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={running === s.id || !s.is_active}
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
