"use client";

import type { SSEEvent } from "@/hooks/useSSE";
import { AlertCircle, Bell, CheckCircle, Clock, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

interface LiveActivityFeedProps {
  events: SSEEvent[];
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusConfig(event: string) {
  switch (event) {
    case "application_completed":
      return {
        icon: CheckCircle,
        color: "text-green-400",
        bg: "bg-green-500/10",
        label: "Completed",
      };
    case "application_failed":
      return {
        icon: AlertCircle,
        color: "text-red-400",
        bg: "bg-red-500/10",
        label: "Failed",
      };
    case "approval_required":
      return {
        icon: Clock,
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        label: "Awaiting Approval",
      };
    case "connected":
      return {
        icon: CheckCircle,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        label: "Connected",
      };
    default:
      return {
        icon: Loader2,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        label: "Running",
      };
  }
}

export function LiveActivityFeed({ events }: LiveActivityFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events.length]);

  const displayEvents = events.slice(0, 20);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Bell className="h-4 w-4 text-indigo-400" />
        <h3 className="font-semibold text-sm">Live Activity</h3>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
      >
        {displayEvents.map((evt, idx) => {
          const config = statusConfig(evt.event);
          const Icon = config.icon;
          const isNew = idx === 0;

          return (
            <div
              key={evt.id}
              className={`flex items-start gap-3 rounded-lg p-2.5 transition-all ${config.bg} ${isNew ? "animate-slide-in" : ""}`}
            >
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {(evt.data.jobTitle as string) ||
                    (evt.data.title as string) ||
                    evt.event}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {(evt.data.company as string) ||
                    (evt.data.message as string) ||
                    ""}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${config.bg} ${config.color}`}
                  >
                    {config.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(evt.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {displayEvents.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            No recent activity
          </div>
        )}
      </div>
    </div>
  );
}
