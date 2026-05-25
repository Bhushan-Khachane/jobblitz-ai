"use client";

import { useCallback, useEffect, useState } from "react";
import { applicationsAPI, type Application } from "@/lib/api";

export function useApprovalQueue() {
  const [queue, setQueue] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await applicationsAPI.approvalQueue();
      setQueue(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; detail?: string } } };
      setError(err.response?.data?.error || err.response?.data?.detail || "Failed to load approval queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const approve = useCallback(
    async (id: string) => {
      await applicationsAPI.approve(id);
      setQueue((q) => q.filter((a) => a.id !== id));
    },
    []
  );

  const reject = useCallback(
    async (id: string) => {
      await applicationsAPI.reject(id);
      setQueue((q) => q.filter((a) => a.id !== id));
    },
    []
  );

  const answerQuestions = useCallback(
    async (id: string, answers: { question: string; answer: string }[]) => {
      await applicationsAPI.answerQuestions(id, answers);
      setQueue((q) => q.filter((a) => a.id !== id));
    },
    []
  );

  return { queue, loading, error, refetch: fetch, approve, reject, answerQuestions };
}