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
]);

export function useRunStatus(run_id: string | null) {
  const [data, setData] = useState<RunStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const notFoundCount = useRef(0);

  const poll = useCallback(async (id: string) => {
    try {
      const resp = await api.get<RunStatus>(`/discovery/run/${id}/status`);
      const status = resp.data.status;

      if (status === "not_found" || status === "unknown") {
        notFoundCount.current += 1;
        // Give up after 20 consecutive not_found (~60s)
        if (notFoundCount.current >= 20) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsPolling(false);
          setData({ status: "failed", error: "Workflow did not start. Check orchestrator logs." });
        }
        return; // don't update UI yet
      }

      notFoundCount.current = 0;
      setData(resp.data);

      if (TERMINAL_STATES.has(status)) {
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
      notFoundCount.current = 0;
      return;
    }
    notFoundCount.current = 0;
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
