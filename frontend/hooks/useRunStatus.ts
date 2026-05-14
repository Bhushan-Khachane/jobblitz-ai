"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";

interface RunStatus {
  status: string;
  events?: Record<string, unknown>[];
  pending_approvals?: number;
  error?: string | null;
}

const TERMINAL_STATES = new Set([
  "pending_approval",
  "skipped",
  "failed",
  "completed",
  "error",
  "unknown",
]);

export function useRunStatus(run_id: string | null) {
  const [data, setData] = useState<RunStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const poll = useCallback(async (id: string) => {
    try {
      const resp = await api.get<RunStatus>(`/discovery/run/${id}/status`);
      setData(resp.data);
      if (TERMINAL_STATES.has(resp.data.status)) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsPolling(false);
      }
    } catch {
      // ignore transient errors, keep polling
    }
  }, []);

  useEffect(() => {
    if (!run_id) {
      setData(null);
      setIsPolling(false);
      return;
    }
    setIsPolling(true);
    poll(run_id);
    intervalRef.current = setInterval(() => poll(run_id), 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsPolling(false);
    };
  }, [run_id, poll]);

  return { runStatus: data, isPolling };
}
