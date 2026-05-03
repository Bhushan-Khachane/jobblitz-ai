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
  onClick?: () => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  submitted: "bg-blue-100 text-blue-700",
  applied: "bg-blue-100 text-blue-700",
  interview: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  accepted: "bg-emerald-100 text-emerald-700",
};

export default function JobCard({ title, company, location, platform, appliedDate, status, onClick }: JobCardProps) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-semibold text-gray-900 text-sm leading-tight">{title}</h4>
          <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
            {platform}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <Building2 className="w-3 h-3" />
          <span>{company}</span>
        </div>
        {location && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
            <MapPin className="w-3 h-3" />
            <span>{location}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <Badge className={statusColors[status] || "bg-gray-100 text-gray-700"} variant="secondary">
            {status}
          </Badge>
          {appliedDate && (
            <span className="text-[10px] text-gray-400">
              {new Date(appliedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
