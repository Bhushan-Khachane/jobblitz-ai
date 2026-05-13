"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle, ExternalLink, Loader2, ClipboardPaste } from "lucide-react";
import api from "@/lib/api";

const PORTAL_URLS: Record<string, string> = {
  naukri: "https://www.naukri.com/mnjuser/homepage",
  linkedin: "https://www.linkedin.com/feed/",
};

const PORTAL_LOGIN_URLS: Record<string, string> = {
  naukri: "https://www.naukri.com/nlogin/login",
  linkedin: "https://www.linkedin.com/login",
};

export default function ConnectPortalPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const portal = params.portal as string;
  const sessionId = searchParams.get("session_id");

  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [cookieJson, setCookieJson] = useState("");
  const [loginMethod, setLoginMethod] = useState<string>("cookie"); // "handoff" | "cookie"
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided.");
      return;
    }
    // Fetch session info to determine login method
    api.get(`/portal-sessions/${sessionId}/status`)
      .then((res) => {
        setSessionInfo(res.data);
        setLoginMethod(res.data.login_method || "cookie");
      })
      .catch(() => {
        // Default to cookie import if we can't detect
        setLoginMethod("cookie");
      });
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

  const handleImportCookies = async () => {
    if (!sessionId || !cookieJson.trim()) return;
    setVerifying(true);
    setError("");
    try {
      let cookies: any[];
      try {
        cookies = JSON.parse(cookieJson.trim());
        if (!Array.isArray(cookies)) {
          throw new Error("Cookie JSON must be an array.");
        }
      } catch (parseErr: any) {
        setError(`Invalid JSON: ${parseErr.message}`);
        setVerifying(false);
        return;
      }

      const res = await api.post(`/portal-sessions/${sessionId}/import-cookies`, {
        portal,
        cookies,
      });
      if (res.data.status === "active") {
        setVerified(true);
      } else {
        setError(res.data.error || "Cookie import failed. Please try again.");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Cookie import failed.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground capitalize">Connect {portal}</h1>
        <p className="text-muted-foreground mt-1">
          JobBlitz never sees your password. Choose a login method below.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setLoginMethod("cookie")}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            loginMethod === "cookie"
              ? "bg-primary-500 text-primary-foreground"
              : "bg-card border border-border text-foreground hover:bg-primary-500/10"
          }`}
        >
          Cookie Import (Recommended)
        </button>
        <button
          onClick={() => setLoginMethod("handoff")}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            loginMethod === "handoff"
              ? "bg-primary-500 text-primary-foreground"
              : "bg-card border border-border text-foreground hover:bg-primary-500/10"
          }`}
        >
          Open Browser Window
        </button>
      </div>

      {loginMethod === "handoff" ? (
        <div className="space-y-4 bg-card p-6 rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
              1
            </div>
            <p className="text-sm text-foreground">
              Click the button below to open a {portal.title()} login window on your screen.
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

          {!verified && (
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
                "I Have Logged In"
              )}
            </button>
          )}
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
                href="https://chrome.google.com/webstore/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 hover:underline inline-flex items-center gap-1"
              >
                EditThisCookie <ExternalLink className="w-3 h-3" />
              </a>{" "}
              extension (or similar).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
              2
            </div>
            <p className="text-sm text-foreground">
              Open{" "}
              <a
                href={PORTAL_LOGIN_URLS[portal]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 hover:underline inline-flex items-center gap-1"
              >
                {PORTAL_LOGIN_URLS[portal]} <ExternalLink className="w-3 h-3" />
              </a>{" "}
              in your own browser and log in.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
              3
            </div>
            <p className="text-sm text-foreground">
              Click EditThisCookie icon → Export → copy JSON → paste below.
            </p>
          </div>

          <div className="space-y-2">
            <textarea
              value={cookieJson}
              onChange={(e) => setCookieJson(e.target.value)}
              placeholder={`Paste cookie JSON here...\nExample: [{"name":"li_at","value":"...","domain":".linkedin.com"}]`}
              rows={4}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={handleImportCookies}
              disabled={verifying || !sessionId || !cookieJson.trim()}
              className="w-full px-4 py-3 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {verifying ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Importing & Verifying...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <ClipboardPaste className="w-4 h-4" /> Import Cookies & Verify
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {verified ? (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <p className="text-sm text-green-400 font-medium">
            Session verified! You can now use discovery and auto-apply for {portal}.
          </p>
        </div>
      ) : null}

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
