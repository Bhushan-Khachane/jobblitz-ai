"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircle,
  ExternalLink,
  Loader2,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import api from "@/lib/api";

const PORTAL_URLS: Record<string, string> = {
  naukri: "https://www.naukri.com/nlogin/login",
  linkedin: "https://www.linkedin.com/login",
  indeed: "https://secure.indeed.com/auth",
};

export default function ConnectPortalPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const portal = params.portal as string;
  const sessionId = searchParams.get("session_id");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [evidence, setEvidence] = useState<any>(null);

  // Fetch session status on load
  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided.");
      return;
    }
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    if (!sessionId) return;
    try {
      const res = await api.get(`/portal-sessions/${sessionId}/status`);
      if (res.data.status === "active") {
        setVerified(true);
        setStep(3);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to fetch session status.");
    }
  };

  const handleOpenPortal = () => {
    const url = PORTAL_URLS[portal];
    if (url) {
      window.open(url, "_blank");
    }
    setStep(2);
  };

  const handleVerify = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError("");
    setEvidence(null);
    try {
      const res = await api.post(`/portal-sessions/${sessionId}/verify`, {
        portal,
      });
      setEvidence(res.data);
      if (res.data.verified) {
        setVerified(true);
        setStep(3);
      } else {
        setError(res.data.reason || "Login not detected. Please try again.");
        setStep(3);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Verification failed.");
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  const handleTryAgain = () => {
    setStep(1);
    setError("");
    setEvidence(null);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <button
          onClick={() => router.push("/portals")}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-3 h-3" /> Back to Portals
        </button>
        <h1 className="text-2xl font-bold text-foreground capitalize">
          Connect your {portal} account
        </h1>
        <p className="text-muted-foreground mt-1">
          We never store your password.
        </p>
      </div>

      {/* Step 1 — Open portal */}
      {step === 1 && (
        <div className="bg-card p-6 rounded-xl border border-border space-y-4">
          <p className="text-sm text-foreground">
            Log in to {portal.charAt(0).toUpperCase() + portal.slice(1)} in a new tab,
            then come back and confirm below.
          </p>
          <button
            onClick={handleOpenPortal}
            className="w-full px-4 py-3 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Open {portal.charAt(0).toUpperCase() + portal.slice(1)}
          </button>
        </div>
      )}

      {/* Step 2 — Waiting */}
      {step === 2 && (
        <div className="bg-card p-6 rounded-xl border border-border space-y-4">
          <p className="text-sm text-foreground">
            Waiting for you to log in...
          </p>
          <button
            onClick={handleVerify}
            disabled={loading}
            className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
              </span>
            ) : (
              "I've Logged In"
            )}
          </button>
        </div>
      )}

      {/* Step 3 — Result */}
      {step === 3 && (
        <>
          {verified ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-sm text-green-400 font-medium">
                  Connected ✅ Ready to apply
                </p>
                <button
                  onClick={() => router.push("/portals")}
                  className="mt-2 text-sm text-primary-400 hover:text-primary-300 underline"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <p className="text-sm font-medium text-red-400">
                    Connection failed
                  </p>
                </div>
                {error && (
                  <p className="text-sm text-red-400/80">{error}</p>
                )}
                {evidence?.page_text_excerpt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {evidence.page_text_excerpt.substring(0, 200)}
                    {evidence.page_text_excerpt.length > 200 ? "..." : ""}
                  </p>
                )}
              </div>
              <button
                onClick={handleTryAgain}
                className="w-full px-4 py-3 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
              >
                Try Again
              </button>
            </div>
          )}
        </>
      )}

      {/* Evidence display on failure */}
      {evidence && !evidence.verified && step === 3 && !verified && (
        <div className="space-y-2 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <p className="text-sm font-medium text-yellow-400">
              Verification details
            </p>
          </div>
          {evidence.url && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">URL:</span> {evidence.url}
            </p>
          )}
          {evidence.reason && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Reason:</span> {evidence.reason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
