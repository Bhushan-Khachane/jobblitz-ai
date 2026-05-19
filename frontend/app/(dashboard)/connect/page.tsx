"use client";

import { useState, useEffect } from "react";
import { Linkedin, Briefcase } from "lucide-react";
import api from "@/lib/api";
import PlatformStatusPill from "@/components/dashboard/PlatformStatusPill";

const PLATFORMS = [
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: Linkedin,
    description: "Connect your LinkedIn account for Easy Apply and job discovery",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  {
    id: "naukri",
    name: "Naukri",
    icon: Briefcase,
    description: "Connect your Naukri account for Indian job applications",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
];

export default function ConnectPage() {
  const [connectedPlatforms, setConnectedPlatforms] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get("/credentials/")
      .then(({ data }) => {
        const connected: Record<string, boolean> = {};
        (data as { platform: string; is_active: boolean }[]).forEach((c) => {
          if (c.is_active) connected[c.platform] = true;
        });
        setConnectedPlatforms(connected);
      })
      .catch(() => {});
  }, []);

  const handleConnect = async (platform: string) => {
    setErrors((e) => ({ ...e, [platform]: "" }));
    try {
      const res = await api.post("/portal-sessions/", { portal: platform });
      const data = res.data;
      window.location.href = `/portals/connect/${platform}?session_id=${data.session_id}`;
    } catch (err: any) {
      setErrors((e) => ({
        ...e,
        [platform]: err.response?.data?.detail || "Failed to create session. Is the backend running?",
      }));
    }
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Connect Accounts</h1>
        <p className="text-muted-foreground mt-1">
          Log into your job portal accounts through a secure cloud browser.
          Your password never reaches JobBlitz servers.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORMS.map((platform) => (
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
                  {connectedPlatforms[platform.id] ? (
                    <div className="flex items-center gap-3">
                      <PlatformStatusPill platform={platform.id} connected={true} />
                      <button
                        onClick={() => handleConnect(platform.id)}
                        className="text-xs text-primary-500 hover:text-primary-400"
                      >
                        Reconnect
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => handleConnect(platform.id)}
                        className="px-4 py-2 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
                      >
                        Connect {platform.name}
                      </button>
                      {errors[platform.id] && (
                        <p className="mt-2 text-xs text-red-400">{errors[platform.id]}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-white/30 mt-4 text-center">
        Shine, Unstop, Wellfound & Internshala are scraped directly — no login needed.
      </p>

    </div>
  );
}