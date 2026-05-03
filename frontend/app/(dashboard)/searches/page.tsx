"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Globe, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SearchForm from "@/components/dashboard/SearchForm";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import api from "@/lib/api";
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

  const fetchSearches = useCallback(async () => {
    try {
      const { data } = await api.get("/job-searches/");
      setSearches(data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSearches();
  }, [fetchSearches]);

  const handleCreate = async (formData: any) => {
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/job-searches/${editItem.id}`, formData);
      } else {
        await api.post("/job-searches/", formData);
      }
      setDialogOpen(false);
      setEditItem(null);
      await fetchSearches();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this search?")) return;
    try {
      await api.delete(`/job-searches/${id}`);
      await fetchSearches();
    } catch {
      alert("Failed to delete");
    }
  };

  const handleToggle = async (search: JobSearch) => {
    try {
      await api.put(`/job-searches/${search.id}`, { is_active: !search.is_active });
      await fetchSearches();
    } catch {
      // ignore
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

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
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
