"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import api from "@/lib/api";

const PORTAL_URLS: Record<string, string> = {
  naukri: "https://www.naukri.com/mnjuser/homepage",
  linkedin: "https://www.linkedin.com/feed/",
};

export default function ConnectPortalPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const portal = params.portal as string;
  const sessionId = searchParams.get("session_id");

  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided.");
    }
  }, [sessionId]);

  const handleVerify = async () => {
    if (!sessionId) return;
    setVerifying(true);
    setError("");
    try {
      const res = await api.post(`/portal-sessions/${sessionId}/verify`);
      if (res.data.status === "active") {
        setVerified(true);
      } else {
        setError(res.data.error || "Login not detected. Please try again.");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground capitalize">Connect {portal}</h1>
        <p className="text-muted-foreground mt-1">
          Log in manually through your own browser. JobBlitz never sees your password.
        </p>
      </div>

      <div className="space-y-4 bg-card p-6 rounded-xl border border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
            1
          </div>
          <p className="text-sm text-foreground">
            Open{" "}
            <a
              href={PORTAL_URLS[portal]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-400 hover:underline inline-flex items-center gap-1"
            >
              {PORTAL_URLS[portal]} <ExternalLink className="w-3 h-3" />
            </a>{" "}
            in a new tab and log in.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
            2
          </div>
          <p className="text-sm text-foreground">
            Return here and click the button below to verify your session.
          </p>
        </div>
      </div>

      {verified ? (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <p className="text-sm text-green-400 font-medium">
            Session verified! You can now use discovery and auto-apply for {portal}.
          </p>
        </div>
      ) : (
        <button
          onClick={handleVerify}
          disabled={verifying || !sessionId}
          className="w-full px-4 py-3 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {verifying ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
            </span>
          ) : (
            "I have logged in"
          )}
        </button>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
