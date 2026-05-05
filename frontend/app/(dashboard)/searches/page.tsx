"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SearchForm from "@/components/dashboard/SearchForm";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import api, { jobSearchAPI, credentialsAPI } from "@/lib/api";
import { formatDate } from "@/lib/utils";

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
  linkedin: "bg-blue-100 text-blue-700",
  naukri: "bg-yellow-100 text-yellow-700",
  both: "bg-purple-100 text-purple-700",
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
  const [triggerMsg, setTriggerMsg] = useState<string>("");

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
      console.error(e);
      setError(e.response?.data?.detail || "Failed to save search");
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
    setTriggerMsg("");
    try {
      const { data } = await api.post(`/job-searches/${id}/trigger`);
      setTriggerMsg(`✓ Discovery started! Task ID: ${data.task_id}`);
      setTimeout(() => setTriggerMsg(""), 8000);
    } catch (e: any) {
      setTriggerMsg(e.response?.data?.detail || "Failed to trigger search");
    } finally {
      setRunning(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {!hasCredentials && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <span className="text-amber-500 text-xl">⚠️</span>
          <div>
            <p className="font-medium text-amber-800">Auto-apply is not active</p>
            <p className="text-sm text-amber-700 mt-0.5">
              You haven't linked your LinkedIn or Naukri account yet.{" "}
              <a href="/profile" className="underline font-medium">Add credentials</a> to enable automatic job applications.
            </p>
          </div>
        </div>
      )}

      {triggerMsg && (
        <div className={`p-3 rounded-lg text-sm border ${triggerMsg.startsWith("✓")
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-red-50 border-red-200 text-red-700"}`}>
          {triggerMsg}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Job Searches</h1>
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
            <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-700">No searches yet</p>
            <p className="text-sm text-gray-500 mt-1 mb-4">Create your first job search to start discovering opportunities.</p>
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
                      <h3 className="font-semibold text-gray-900">{s.name}</h3>
                      <Badge className={platformColors[s.platform] || "bg-gray-100 text-gray-700"} variant="secondary">
                        {s.platform}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Keywords:</span> {s.keywords}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
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
                      <span className="text-xs text-gray-500">{s.is_active ? "Active" : "Paused"}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={running === s.id || !s.is_active}
                      onClick={() => handleTrigger(s.id)}
                      className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    >
                      {running === s.id ? (
                        <span className="flex items-center gap-1">
                          <span className="animate-spin h-3 w-3 border-2 border-indigo-600 border-t-transparent rounded-full" />
                          Running...
                        </span>
                      ) : (
                        "▶ Run Now"
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
