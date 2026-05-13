"use client";

import { useState, useEffect, useRef } from "react";

interface RunStatus {
  status: string;
  events?: any[];
  error?: string | null;
  [key: string]: any;
}

export function useRunStatus(runId: string | null) {
  const [status, setStatus] = useState<string>("idle");
  const [data, setData] = useState<RunStatus | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!runId) {
      setStatus("idle");
      setData(null);
      return;
    }

    const fetchStatus = async () => {
      try {
        const resp = await fetch(`/api/v1/applications/${runId}/adk-status`);
        const json = await resp.json();
        setStatus(json.status || "unknown");
        setData(json);

        if (["success", "failed", "blocked", "skipped"].includes(json.status)) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (err) {
        setStatus("error");
      }
    };

    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [runId]);

  return { status, data };
}
