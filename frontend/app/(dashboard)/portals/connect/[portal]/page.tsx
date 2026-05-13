"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircle,
  ExternalLink,
  Loader2,
  ClipboardPaste,
  AlertTriangle,
  ArrowLeft,
  Monitor,
} from "lucide-react";
import api from "@/lib/api";

const PORTAL_LOGIN_URLS: Record<string, string> = {
  naukri: "https://www.naukri.com/nlogin/login",
  linkedin: "https://www.linkedin.com/login",
};

export default function ConnectPortalPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const portal = params.portal as string;
  const sessionId = searchParams.get("session_id");

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [cookieJson, setCookieJson] = useState("");
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
      setSession(res.data);
      if (res.data.status === "active") {
        setVerified(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to fetch session status.");
    }
  };

  const handleStartLogin = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError("");
    setEvidence(null);
    try {
      const res = await api.post(`/portal-sessions/${sessionId}/start-login`);
      setSession((prev: any) => ({ ...prev, status: res.data.status }));
      if (res.data.page_text_excerpt) {
        setEvidence({ instruction: res.data.page_text_excerpt });
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to start login.");
    } finally {
      setLoading(false);
    }
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
        setSession((prev: any) => ({ ...prev, status: "active", verified: true }));
      } else {
        setError(res.data.reason || "Login not detected. Please try again.");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportCookies = async () => {
    if (!sessionId || !cookieJson.trim()) return;
    setLoading(true);
    setError("");
    setEvidence(null);

    let cookies: any[];
    try {
      cookies = JSON.parse(cookieJson.trim());
      if (!Array.isArray(cookies)) {
        throw new Error("Cookie JSON must be an array.");
      }
      // Basic validation
      for (const c of cookies) {
        if (!c.name || !c.value) {
          throw new Error("Each cookie must have name and value.");
        }
      }
    } catch (parseErr: any) {
      setError(`Invalid JSON: ${parseErr.message}`);
      setLoading(false);
      return;
    }

    try {
      const res = await api.post(`/portal-sessions/${sessionId}/import-cookies`, {
        portal,
        cookies,
      });
      setEvidence(res.data);
      if (res.data.verified) {
        setVerified(true);
        setSession((prev: any) => ({ ...prev, status: "active", verified: true }));
      } else {
        setError(res.data.reason || "Cookie import failed. Please check your cookies and try again.");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Cookie import failed.");
    } finally {
      setLoading(false);
    }
  };

  const loginMethod = session?.login_method || "cookie";

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
          Connect {portal}
        </h1>
        <p className="text-muted-foreground mt-1">
          JobBlitz never sees your password. Choose a login method below.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { setError(""); setEvidence(null); }}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            loginMethod !== "handoff"
              ? "bg-primary-500 text-primary-foreground"
              : "bg-card border border-border text-foreground hover:bg-primary-500/10"
          }`}
        >
          Cookie Import (Recommended)
        </button>
        <button
          onClick={() => { setError(""); setEvidence(null); }}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            loginMethod === "handoff"
              ? "bg-primary-500 text-primary-foreground"
              : "bg-card border border-border text-foreground hover:bg-primary-500/10"
          }`}
        >
          <Monitor className="w-3 h-3 inline mr-1" />
          Browser Window
        </button>
      </div>

      {/* Session Status Badge */}
      {session && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Session:</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              session.status === "active"
                ? "bg-green-500/20 text-green-400"
                : session.status === "awaiting_manual_login"
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-gray-500/20 text-gray-400"
            }`}
          >
            {session.status}
          </span>
          {session.login_method && (
            <span className="text-xs text-muted-foreground">
              mode: {session.login_method}
            </span>
          )}
        </div>
      )}

      {verified ? (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-sm text-green-400 font-medium">
              Session verified! You can now use discovery and auto-apply for {portal}.
            </p>
            <button
              onClick={() => router.push("/portals")}
              className="mt-2 text-sm text-primary-400 hover:text-primary-300 underline"
            >
              Continue to Portals
            </button>
          </div>
        </div>
      ) : (
        <>
          {loginMethod === "handoff" ? (
            <div className="space-y-4 bg-card p-6 rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
                  1
                </div>
                <p className="text-sm text-foreground">
                  Click Start Login to open a {portal} login window on your screen.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
                  2
                </div>
                <p className="text-sm text-foreground">
                  Log in with your credentials in the opened window.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
                  3
                </div>
                <p className="text-sm text-foreground">
                  Return here and click "I Have Logged In" to verify.
                </p>
              </div>

              <button
                onClick={handleStartLogin}
                disabled={loading || !sessionId}
                className="w-full px-4 py-3 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Starting...
                  </span>
                ) : (
                  "Start Login"
                )}
              </button>

              {evidence?.instruction && (
                <p className="text-sm text-muted-foreground bg-primary-500/5 p-3 rounded-lg">
                  {evidence.instruction}
                </p>
              )}

              <button
                onClick={handleVerify}
                disabled={loading || !sessionId}
                className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                  </span>
                ) : (
                  "I Have Logged In"
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4 bg-card p-6 rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
                  1
                </div>
                <p className="text-sm text-foreground">
                  Install{" "}
                  <a
                    href="https://chromewebstore.google.com/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-400 hover:underline inline-flex items-center gap-1"
                  >
                    EditThisCookie
                    <ExternalLink className="w-3 h-3" />
                  </a>{" "}
                  extension (or similar) in your browser.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
                  2
                </div>
                <p className="text-sm text-foreground">
                  Open{" "}
                  <a
                    href={PORTAL_LOGIN_URLS[portal] || `https://${portal}.com`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-400 hover:underline inline-flex items-center gap-1"
                  >
                    {PORTAL_LOGIN_URLS[portal] || `${portal}.com`}
                    <ExternalLink className="w-3 h-3" />
                  </a>{" "}
                  in your own browser and log in normally.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
                  3
                </div>
                <p className="text-sm text-foreground">
                  Click EditThisCookie icon → Export → copy the JSON.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
                  4
                </div>
                <p className="text-sm text-foreground">
                  Paste the JSON below and click Import & Verify.
                </p>
              </div>

              <div className="space-y-2">
                <textarea
                  value={cookieJson}
                  onChange={(e) => setCookieJson(e.target.value)}
                  placeholder={`Paste cookie JSON here...\nExample: [{"name":"naukri_user","value":"abc123","domain":".naukri.com"}]`}
                  rows={4}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={handleImportCookies}
                  disabled={loading || !sessionId || !cookieJson.trim()}
                  className="w-full px-4 py-3 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing & Verifying...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <ClipboardPaste className="w-4 h-4" />
                      Import Cookies & Verify
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Evidence Display on Failure */}
      {evidence && !evidence.verified && (
        <div className="space-y-2 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <p className="text-sm font-medium text-yellow-400">
              Verification failed — here is what we found
            </p>
          </div>
          {evidence.url && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">URL:</span> {evidence.url}
            </p>
          )}
          {evidence.page_text_excerpt && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Page text:</span>{" "}
              {evidence.page_text_excerpt.substring(0, 200)}
              {evidence.page_text_excerpt.length > 200 ? "..." : ""}
            </p>
          )}
          {evidence.reason && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Reason:</span> {evidence.reason}
            </p>
          )}
        </div>
      )}

      {error && !evidence && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
