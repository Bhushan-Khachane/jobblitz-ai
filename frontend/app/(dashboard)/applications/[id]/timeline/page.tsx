"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle, XCircle, Camera, FileDiff } from "lucide-react";
import api from "@/lib/api";

export default function ApplicationTimelinePage() {
  const params = useParams();
  const id = params.id as string;
  const [events, setEvents] = useState<any[]>([]);
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adkStatus, setAdkStatus] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    fetchTimeline();

    // Poll ADK status
    const interval = setInterval(() => {
      fetchAdkStatus();
    }, 3000);
    fetchAdkStatus();

    return () => clearInterval(interval);
  }, [id]);

  const fetchTimeline = async () => {
    try {
      const res = await api.get(`/application-runs/${id}/timeline`);
      setEvents(res.data || []);
    } catch (err) {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const fetchAdkStatus = async () => {
    try {
      const res = await api.get(`/application-runs/${id}/adk-status`);
      setAdkStatus(res.data);
    } catch {
      // silently fail
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const allEvents = [...events];
  if (adkStatus?.events?.length) {
    // Merge ADK live events
    adkStatus.events.forEach((ev: any) => {
      if (!allEvents.find((e) => e.step_name === ev.step)) {
        allEvents.push({
          id: `adk-${ev.step}`,
          step_name: ev.step,
          tool_name: "adk",
          success: ev.status === "ok" || ev.verified === true,
          error_message: ev.error || null,
          tool_output: JSON.stringify(ev),
          created_at: new Date().toISOString(),
        });
      }
    });
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Application Timeline</h1>
        <p className="text-muted-foreground mt-1">
          Step-by-step audit trail for run {id.slice(0, 8)}...
        </p>
        {adkStatus?.status && (
          <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${
            adkStatus.status === "success" ? "bg-green-500/20 text-green-400" :
            adkStatus.status === "failed" ? "bg-red-500/20 text-red-400" :
            adkStatus.status === "running" ? "bg-primary-500/20 text-primary-400" :
            "bg-amber-500/20 text-amber-400"
          }`}>
            ADK: {adkStatus.status}
          </span>
        )}
      </div>

      <div className="relative space-y-6 pl-6 border-l border-white/10">
        {allEvents.length === 0 && (
          <div className="p-8 text-center text-muted-foreground border border-dashed border-white/10 rounded-xl">
            No timeline events yet.
          </div>
        )}
        {allEvents.map((event: any, idx: number) => (
          <div key={event.id || idx} className="relative">
            <div
              className={`absolute -left-[25px] top-1 w-3 h-3 rounded-full border-2 ${
                event.success
                  ? "bg-green-500 border-green-500"
                  : "bg-red-500 border-red-500"
              }`}
            />
            <div className="p-4 rounded-xl bg-card border border-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{event.step_name}</span>
                  <span className="text-xs text-muted-foreground">({event.tool_name})</span>
                  {event.success ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleString()}
                </span>
              </div>

              {event.error_message && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{event.error_message}</p>
                </div>
              )}

              {event.tool_output && (
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <p className="text-sm text-white/60 font-mono line-clamp-4">{event.tool_output}</p>
                </div>
              )}

              <div className="flex items-center gap-4">
                {event.screenshot_url && (
                  <div className="flex items-center gap-1 text-xs text-primary-400">
                    <Camera className="w-3 h-3" /> Screenshot
                  </div>
                )}
                {event.diff_text && (
                  <div className="flex items-center gap-1 text-xs text-primary-400">
                    <FileDiff className="w-3 h-3" /> Diff
                  </div>
                )}
              </div>

              {event.diff_text && (
                <div className="p-3 rounded-lg bg-white/5 border border-white/5 max-h-40 overflow-y-auto">
                  <pre className="text-xs text-white/50 font-mono">{event.diff_text}</pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
