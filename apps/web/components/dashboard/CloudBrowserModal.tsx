"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Shield, Clock, ExternalLink, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import api from "@/lib/api";

interface CloudBrowserModalProps {
  platform: string;
  streamUrl: string;
  token: string;
  containerId: string;
  expiresAt: string;
  onClose: () => void;
  onVerified: () => void;
}

export default function CloudBrowserModal({
  platform,
  streamUrl,
  token,
  containerId,
  expiresAt,
  onClose,
  onVerified,
}: CloudBrowserModalProps) {
  const [status, setStatus] = useState<"loading" | "active" | "success" | "expired">("loading");
  const [timeLeft, setTimeLeft] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");

  // Open browser in a new tab immediately on mount
  useEffect(() => {
    if (streamUrl) {
      window.open(streamUrl, "_blank", "noopener,noreferrer");
    }
  }, [streamUrl]);

  // Countdown timer
  useEffect(() => {
    const expires = new Date(expiresAt).getTime();
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setStatus("expired");
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const showMessage = (text: string, type: "info" | "success" | "error" = "info") => {
    setMessage(text);
    setMessageType(type);
  };

  // Poll login status
  const checkStatus = useCallback(async () => {
    setVerifying(true);
    setMessage(null);
    try {
      const res = await api.post(`/login-sessions/${platform}/verify?container_id=${containerId}`);
      const data = res.data;
      if (data.status === "success") {
        setStatus("success");
        showMessage(data.message || "Login confirmed and cookies saved!", "success");
        onVerified();
      } else if (data.status === "expired") {
        setStatus("expired");
        showMessage(data.message || "Session has expired.", "error");
      } else {
        showMessage(
          data.message ||
            "Login not detected yet. Make sure you are fully logged in and on the dashboard/feed page, then try again.",
          "info"
        );
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "Unknown error";
      showMessage(`Failed to verify login: ${detail}`, "error");
    } finally {
      setVerifying(false);
    }
  }, [platform, containerId, onVerified]);

  useEffect(() => {
    if (status !== "loading") return;
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [status, checkStatus]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleOpenAgain = () => {
    if (streamUrl) {
      window.open(streamUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-md bg-[#1a1a1e] rounded-xl overflow-hidden border border-[#2a2a2e]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2e]">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-foreground">
              Connect {platform.charAt(0).toUpperCase() + platform.slice(1)}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className={timeLeft < 60 ? "text-destructive" : ""}>
                {formatTime(timeLeft)}
              </span>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {status === "success" ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-primary-500" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {platform.charAt(0).toUpperCase() + platform.slice(1)} Connected
            </h3>
            <p className="text-muted-foreground mb-4">
              Your session cookies have been securely saved.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600"
            >
              Close
            </button>
          </div>
        ) : status === "expired" ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-xl font-semibold text-destructive mb-2">Session Expired</h3>
            <p className="text-muted-foreground mb-4">
              Your 10-minute session has ended. Please create a new one.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Session opened message */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-primary-500/10 flex items-center justify-center">
                <ExternalLink className="w-6 h-6 text-primary-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Secure browser opened in a new tab
              </h3>
              <p className="text-sm text-muted-foreground">
                A new tab was opened with an isolated cloud browser. Log into{" "}
                {platform.charAt(0).toUpperCase() + platform.slice(1)} there, then return here and
                click <strong>Save Session</strong>.
              </p>
            </div>

            {/* Feedback message */}
            {message && (
              <div
                className={`rounded-lg p-3 text-sm text-center flex items-start gap-2 ${
                  messageType === "error"
                    ? "bg-destructive/10 text-destructive border border-destructive/20"
                    : messageType === "success"
                      ? "bg-primary-500/10 text-primary-400 border border-primary-500/20"
                      : "bg-primary-500/10 text-primary-400 border border-primary-500/20"
                }`}
              >
                {messageType === "error" ? (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                ) : messageType === "success" ? (
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
                )}
                <span>{message}</span>
              </div>
            )}

            {/* Security note */}
            <div className="bg-primary-500/10 border border-primary-500/20 rounded-lg p-4">
              <p className="text-xs text-primary-400 text-center">
                Your password never reaches JobBlitz servers. This is an isolated cloud browser session.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={handleOpenAgain}
                disabled={verifying}
                className="w-full px-4 py-2.5 bg-[#2a2a2e] text-foreground rounded-lg hover:bg-[#3a3a3e] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ExternalLink className="w-4 h-4" />
                Open Browser Again
              </button>
              <button
                onClick={checkStatus}
                disabled={verifying}
                className="w-full px-4 py-2.5 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "I'm logged in — Save Session"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
