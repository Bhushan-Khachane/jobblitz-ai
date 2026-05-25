"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, ExternalLink } from "lucide-react";

interface JobCardProps {
  title: string;
  company: string;
  location?: string;
  platform: string;
  appliedDate?: string;
  status: string;
  approvalStatus?: string | null;
  onClick?: () => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  submitted: "bg-blue-500/15 text-blue-400",
  applied: "bg-blue-500/15 text-blue-400",
  interview: "bg-green-500/15 text-green-400",
  rejected: "bg-red-500/15 text-red-400",
  failed: "bg-red-500/15 text-red-400",
  accepted: "bg-green-500/15 text-green-400",
  skipped: "bg-muted text-muted-foreground",
};

const approvalColors: Record<string, string> = {
  pending_approval: "bg-orange-500/15 text-orange-400",
  approved: "bg-green-500/15 text-green-400",
  rejected: "bg-red-500/15 text-red-400",
};

export default function JobCard({ title, company, location, platform, appliedDate, status, approvalStatus, onClick }: JobCardProps) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-semibold text-foreground text-sm leading-tight">{title}</h4>
          <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
            {platform}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          <Building2 className="w-3 h-3" />
          <span>{company}</span>
        </div>
        {location && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mb-2">
            <MapPin className="w-3 h-3" />
            <span>{location}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Badge className={statusColors[status] || "bg-muted text-muted-foreground"} variant="secondary">
              {status}
            </Badge>
            {approvalStatus && (
              <Badge className={approvalColors[approvalStatus] || "bg-muted text-muted-foreground"} variant="secondary">
                {approvalStatus === "pending_approval" ? "awaiting approval" : approvalStatus}
              </Badge>
            )}
          </div>
          {appliedDate && (
            <span className="text-[10px] text-muted-foreground/70">
              {new Date(appliedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
