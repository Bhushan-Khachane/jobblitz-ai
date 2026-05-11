"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Shield, Clock } from "lucide-react";
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

  // Poll login status
  const checkStatus = useCallback(async () => {
    try {
      const res = await api.post(`/login-sessions/${platform}/verify?container_id=${containerId}`);
      const data = res.data;
      if (data.status === "success") {
        setStatus("success");
        onVerified();
      }
    } catch {
      // Continue polling
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-4xl h-[80vh] bg-[#1a1a1e] rounded-xl overflow-hidden border border-[#2a2a2e]">
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

        {/* Security badge */}
        <div className="px-4 py-2 bg-primary-500/10 border-b border-primary-500/20">
          <p className="text-xs text-primary-400 text-center">
            Your password never reaches JobBlitz servers. This is a secure, isolated browser session.
          </p>
        </div>

        {/* Browser iframe */}
        <div className="flex-1 h-full">
          {status === "success" ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-500/20 flex items-center justify-center">
                  <Shield className="w-8 h-8 text-primary-500" />
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
            </div>
          ) : status === "expired" ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
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
            </div>
          ) : (
            <iframe
              src={`${streamUrl}?token=${token}`}
              className="w-full h-full border-0"
              title={`${platform} Login`}
            />
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-[#0e0e10]/90 backdrop-blur-sm">
          <button
            onClick={checkStatus}
            className="w-full px-4 py-2 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600 transition-colors"
          >
            I&apos;m logged in — Save Session
          </button>
        </div>
      </div>
    </div>
  );
}