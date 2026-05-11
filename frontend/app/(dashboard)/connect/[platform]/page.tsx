"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import CloudBrowserModal from "@/components/dashboard/CloudBrowserModal";

export default function PlatformConnectPage() {
  const params = useParams();
  const platform = params.platform as string;
  const [session, setSession] = useState<{
    streamUrl: string;
    token: string;
    containerId: string;
    expiresAt: string;
  } | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const createSession = async () => {
    setSessionError(null);
    try {
      const res = await api.post(`/login-sessions?platform=${platform}`);
      const data = res.data;
      setSession({
        streamUrl: data.stream_url,
        token: data.token,
        containerId: data.container_id,
        expiresAt: data.expires_at,
      });
    } catch (err: any) {
      console.error("Failed to create session:", err);
      setSessionError(err.response?.data?.detail || "Failed to create browser session. Is Docker running?");
    }
  };

  useEffect(() => {
    createSession();
  }, [platform]);

  if (sessionError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive font-medium">{sessionError}</p>
        <button
          onClick={createSession}
          className="px-4 py-2 bg-primary-500 text-primary-foreground rounded-lg text-sm hover:bg-primary-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Creating secure browser session...</div>
      </div>
    );
  }

  return (
    <CloudBrowserModal
      platform={platform}
      streamUrl={session.streamUrl}
      token={session.token}
      containerId={session.containerId}
      expiresAt={session.expiresAt}
      onClose={() => window.history.back()}
      onVerified={() => {
        window.history.back();
      }}
    />
  );
}