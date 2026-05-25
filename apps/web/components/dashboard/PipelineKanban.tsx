"use client";

import { useApplicationStream, type Application } from "@/hooks/useApplicationStream";
import MatchScoreBadge from "./MatchScoreBadge";

const COLUMNS = [
  { key: "discovered", label: "Discovered", color: "border-gray-500" },
  { key: "pending", label: "Pending", color: "border-amber-500" },
  { key: "pending_manual", label: "Manual Required", color: "border-orange-500" },
  { key: "submitted", label: "Applied", color: "border-primary-500" },
  { key: "interview", label: "Interview", color: "border-green-500" },
  { key: "rejected", label: "Rejected", color: "border-destructive" },
] as const;

export default function PipelineKanban({ userId }: { userId: string }) {
  const { applications, loading } = useApplicationStream(userId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading pipeline...
      </div>
    );
  }

  const grouped = COLUMNS.map((col) => ({
    ...col,
    items: applications.filter((app) => {
      if (col.key === "pending") return app.status === "pending" && !app.approval_status;
      if (col.key === "pending_manual") return app.status === "pending_manual" || (app.status === "pending" && app.approval_status === "pending_approval");
      return app.status === col.key;
    }),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {grouped.map((column) => (
        <div key={column.key} className="flex-shrink-0 w-72">
          <div className={`border-t-2 ${column.color} pt-2 mb-3`}>
            <h3 className="text-sm font-medium text-foreground">
              {column.label}
              <span className="ml-2 text-xs text-muted-foreground">
                {column.items.length}
              </span>
            </h3>
          </div>
          <div className="space-y-2">
            {column.items.map((app) => (
              <ApplicationCard key={app.id} application={app} />
            ))}
            {column.items.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">
                No applications
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ApplicationCard({ application }: { application: Application }) {
  return (
    <div className="p-3 rounded-lg bg-[#1a1a1e] border border-[#2a2a2e] hover:border-primary-500/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            Application
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(application.created_at).toLocaleDateString()}
          </p>
        </div>
        <MatchScoreBadge score={null} size="sm" />
      </div>
      {application.error_message && (
        <p className="text-xs text-destructive mt-1 truncate">
          {application.error_message}
        </p>
      )}
    </div>
  );
}