"use client";

import { useApplicationStream, type Application } from "@/hooks/useApplicationStream";

export default function ApplicationTimeline({ userId }: { userId: string }) {
  const { applications, loading } = useApplicationStream(userId);

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading timeline...</div>;
  }

  const sorted = [...applications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const statusIcons: Record<string, string> = {
    discovered: "🔍",
    pending: "⏳",
    submitted: "✅",
    interview: "🎤",
    rejected: "❌",
    failed: "⚠️",
    skipped: "⏭️",
  };

  return (
    <div className="space-y-4">
      {sorted.slice(0, 20).map((app) => (
        <div key={app.id} className="flex gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1a1a1e] border border-[#2a2a2e] flex items-center justify-center text-sm">
            {statusIcons[app.status] || "📋"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(app.created_at).toLocaleDateString()}
              </span>
            </div>
            {app.error_message && (
              <p className="text-xs text-destructive mt-0.5 truncate">{app.error_message}</p>
            )}
          </div>
        </div>
      ))}
      {sorted.length === 0 && (
        <p className="text-sm text-muted-foreground">No applications yet.</p>
      )}
    </div>
  );
}