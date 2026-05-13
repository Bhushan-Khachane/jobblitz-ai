"use client";

import { useState, useEffect } from "react";
import { Linkedin, Briefcase, ExternalLink, RefreshCw, Trash2, Loader2 } from "lucide-react";
import api from "@/lib/api";
import Link from "next/link";

const PLATFORMS = [
  {
    id: "naukri",
    name: "Naukri",
    icon: Briefcase,
    description: "Connect your Naukri account for Indian job applications",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: Linkedin,
    description: "Connect your LinkedIn account for Easy Apply and job discovery",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
];

export default function PortalsPage() {
  const [sessions, setSessions] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await api.get("/portal-sessions/");
      const sessionMap: Record<string, any> = {};
      for (const s of res.data.sessions || []) {
        // Keep the most recent session per portal
        if (!sessionMap[s.portal] || new Date(s.created_at) > new Date(sessionMap[s.portal].created_at)) {
          sessionMap[s.portal] = s;
        }
      }
      setSessions(sessionMap);
    } catch (err) {
      console.error("Failed to fetch sessions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform: string) => {
    setConnecting(platform);
    try {
      const res = await api.post("/portal-sessions/", { portal: platform });
      const data = res.data;
      setSessions((prev) => ({
        ...prev,
        [platform]: data,
      }));
      window.location.href = `/portals/connect/${platform}?session_id=${data.session_id}`;
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create session");
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (sessionId: string, platform: string) => {
    if (!confirm(`Disconnect ${platform}? You will need to reconnect to apply jobs.`)) return;
    try {
      await api.delete(`/portal-sessions/${sessionId}`);
      setSessions((prev) => {
        const next = { ...prev };
        delete next[platform];
        return next;
      });
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to disconnect");
    }
  };

  const statusBadge = (session: any) => {
    if (!session) return null;
    switch (session.status) {
      case "active":
        return (
          <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
            Connected
          </span>
        );
      case "pending_login":
      case "awaiting_manual_login":
        return (
          <span className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
            Pending
          </span>
        );
      case "expired":
        return (
          <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
            Expired
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded-full bg-gray-500/20 text-gray-400 text-xs font-medium">
            {session.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Portals</h1>
        <p className="text-muted-foreground mt-1">
          Connect your job portal accounts securely. No passwords are stored.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading sessions...</span>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORMS.map((platform) => {
          const session = sessions[platform.id];
          return (
            <div
              key={platform.id}
              className={`p-6 rounded-xl ${platform.bg} border ${platform.border}`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${platform.bg}`}>
                  <platform.icon className={`w-6 h-6 ${platform.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{platform.name}</h3>
                    {statusBadge(session)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{platform.description}</p>

                  {session?.last_verified_at ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last verified: {new Date(session.last_verified_at).toLocaleString()}
                    </p>
                  ) : null}

                  <div className="mt-4 flex items-center gap-2">
                    {session?.status === "active" ? (
                      <>
                        <button
                          onClick={() => handleConnect(platform.id)}
                          disabled={!!connecting}
                          className="px-4 py-2 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          {connecting === platform.id ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> Reconnecting...
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <RefreshCw className="w-3 h-3" /> Reconnect
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => handleDisconnect(session.session_id, platform.id)}
                          className="px-3 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(platform.id)}
                        disabled={!!connecting}
                        className="px-4 py-2 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        {connecting === platform.id ? (
                          <span className="flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Connecting...
                          </span>
                        ) : (
                          `Connect ${platform.name}`
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
