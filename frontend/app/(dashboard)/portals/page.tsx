"use client";

import { useState, useEffect } from "react";
import { Linkedin, Briefcase, ExternalLink, RefreshCw } from "lucide-react";
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // TODO: fetch portal sessions from /api/v1/portal-sessions
  }, []);

  const handleConnect = async (platform: string) => {
    setLoading(true);
    try {
      const res = await api.post("/portal-sessions/", { portal: platform });
      const data = res.data;
      setSessions((prev) => ({
        ...prev,
        [platform]: { session_id: data.session_id, status: data.status },
      }));
      // Navigate to connect flow
      window.location.href = `/portals/connect/${platform}?session_id=${data.session_id}`;
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create session");
    } finally {
      setLoading(false);
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
                  <h3 className="font-semibold text-foreground">{platform.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{platform.description}</p>
                  <div className="mt-4">
                    {session?.status === "active" ? (
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                          Connected
                        </span>
                        <button
                          onClick={() => handleConnect(platform.id)}
                          className="text-xs text-primary-500 hover:text-primary-400 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Reconnect
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConnect(platform.id)}
                        disabled={loading}
                        className="px-4 py-2 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        {loading ? "Connecting..." : `Connect ${platform.name}`}
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
