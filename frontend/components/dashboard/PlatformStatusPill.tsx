"use client";

import { Linkedin, Briefcase } from "lucide-react";

interface PlatformStatusPillProps {
  platform: "linkedin" | "naukri" | "indeed" | string;
  connected: boolean;
  onReconnect?: () => void;
}

const platformConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  linkedin: {
    label: "LinkedIn",
    icon: <Linkedin className="w-4 h-4" />,
    color: "text-blue-400",
  },
  naukri: {
    label: "Naukri",
    icon: <Briefcase className="w-4 h-4" />,
    color: "text-amber-400",
  },
};

export default function PlatformStatusPill({ platform, connected, onReconnect }: PlatformStatusPillProps) {
  const config = platformConfig[platform] || {
    label: platform,
    icon: <Briefcase className="w-4 h-4" />,
    color: "text-gray-400",
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a1e] border border-[#2a2a2e]">
      <span className={config.color}>{config.icon}</span>
      <span className="text-sm text-foreground">{config.label}</span>
      {connected ? (
        <span className="w-2 h-2 rounded-full bg-green-500" />
      ) : (
        <button
          onClick={onReconnect}
          className="text-xs text-destructive hover:text-destructive/80 underline"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}