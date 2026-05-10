"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";

export interface Application {
  id: string;
  job_listing_id: string;
  resume_id: string | null;
  status: string;
  approval_status: string | null;
  cover_letter: string | null;
  error_message: string | null;
  screenshot_path: string | null;
  retry_count: number;
  applied_at: string | null;
  created_at: string;
}

interface UseApplicationsOpts {
  status?: string;
  page?: number;
  pageSize?: number;
}

export function useApplications(opts: UseApplicationsOpts = {}) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page: opts.page || 1,
        page_size: opts.pageSize || 50,
      };
      if (opts.status) params.status = opts.status;
      const { data } = await api.get("/applications/", { params });
      setApplications(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, [opts.status, opts.page, opts.pageSize]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const updateStatus = useCallback(
    async (id: string, status: string) => {
      await api.put(`/applications/${id}/status`, { status });
      await fetch();
    },
    [fetch]
  );

  return { applications, total, loading, error, refetch: fetch, updateStatus };
}
