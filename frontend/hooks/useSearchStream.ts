"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import api from "@/lib/api";

export interface JobSearch {
  id: string;
  user_id: string;
  name: string;
  platform: string;
  keywords: string;
  location: string | null;
  experience_level: string | null;
  job_type: string | null;
  remote_only: boolean;
  salary_min_lpa: number | null;
  salary_max_lpa: number | null;
  extra_filters: Record<string, unknown> | null;
  is_active: boolean;
  auto_match: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useSearchStream(userId: string) {
  const [searches, setSearches] = useState<JobSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Initial fetch via REST API
    async function fetchInitial() {
      try {
        const res = await api.get("/job-searches/");
        const data = res.data;
        setSearches(data.items || data.searches || data);
      } catch (err) {
        console.error("Failed to fetch searches:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchInitial();

    // Real-time subscription (graceful no-op if Supabase not configured)
    if (!supabase) return;

    const channel = supabase
      .channel("job_searches")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_searches",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newSearch = payload.new as JobSearch;
          setSearches((prev) => {
            const idx = prev.findIndex((s) => s.id === newSearch.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = newSearch;
              return updated;
            }
            return [newSearch, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [userId]);

  return { searches, setSearches, loading };
}