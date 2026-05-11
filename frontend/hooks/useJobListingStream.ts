"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface JobListing {
  id: string;
  user_id: string;
  job_search_id: string | null;
  platform: string;
  external_job_id: string | null;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  apply_url: string | null;
  salary_info: string | null;
  posted_date: string | null;
  status: string;
  match_score: number | null;
  match_explanation: Record<string, unknown> | null;
  extra_data: Record<string, unknown> | null;
  created_at: string;
}

export function useJobListingStream(userId: string) {
  const [listings, setListings] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const channel = supabase
      .channel("job_listings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_listings",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newListing = payload.new as JobListing;
          setListings((prev) => {
            const idx = prev.findIndex((l) => l.id === newListing.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = newListing;
              return updated;
            }
            return [newListing, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { listings, setListings, loading };
}