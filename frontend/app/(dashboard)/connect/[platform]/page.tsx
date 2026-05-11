"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CloudBrowserModal from "@/components/dashboard/CloudBrowserModal";

export default function PlatformConnectPage() {
  const params = useParams();
  const platform = params.platform as string;
  const [session, setSession] = useState<{
    streamUrl: string;
    token: string;
    expiresAt: string;
  } | null>(null);

  useEffect(() => {
    async function createSession() {
      try {
        const res = await fetch(`/api/v1/login-sessions?platform=${platform}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("jb_access_token")}`,
          },
        });
        const data = await res.json();
        setSession({
          streamUrl: data.stream_url,
          token: data.token,
          expiresAt: data.expires_at,
        });
      } catch (err) {
        console.error("Failed to create session:", err);
      }
    }
    createSession();
  }, [platform]);

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
      expiresAt={session.expiresAt}
      onClose={() => window.history.back()}
      onVerified={() => {
        window.history.back();
      }}
    />
  );
}