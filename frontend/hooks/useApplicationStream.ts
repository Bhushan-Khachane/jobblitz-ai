"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface Application {
  id: string;
  user_id: string;
  job_listing_id: string;
  resume_id: string | null;
  status: string;
  approval_status: string | null;
  cover_letter: string | null;
  tailored_resume_path: string | null;
  error_message: string | null;
  screenshot_path: string | null;
  retry_count: number;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useApplicationStream(userId: string) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch
    async function fetchInitial() {
      try {
        const res = await fetch("/api/v1/applications/", {
          headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setApplications(data.applications || data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch applications");
      } finally {
        setLoading(false);
      }
    }

    fetchInitial();

    // Real-time subscription
    const channel = supabase
      .channel("applications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "applications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newApp = payload.new as Application;
          setApplications((prev) => {
            const idx = prev.findIndex((a) => a.id === newApp.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = newApp;
              return updated;
            }
            return [newApp, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { applications, loading, error };
}