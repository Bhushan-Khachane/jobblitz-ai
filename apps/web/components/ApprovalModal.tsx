"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import api from "@/lib/api";
import { Check, Clock, X } from "lucide-react";
import { useEffect, useState } from "react";

export interface ApprovalPayload {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  matchScore?: number;
  resumePreview?: string;
  expiresAt?: string;
}

interface ApprovalModalProps {
  payload: ApprovalPayload | null;
  onClose: () => void;
  onAction: () => void;
}

export function ApprovalModal({
  payload,
  onClose,
  onAction,
}: ApprovalModalProps) {
  const [countdown, setCountdown] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!payload?.expiresAt) return;

    const interval = setInterval(() => {
      const diff = new Date(payload.expiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("Expired");
        clearInterval(interval);
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdown(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [payload?.expiresAt]);

  if (!payload) return null;

  const handleApprove = async () => {
    setLoading(true);
    try {
      await api.post(`/api/applications/${payload.applicationId}/approve`);
      onAction();
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await api.post(`/api/applications/${payload.applicationId}/reject`);
      onAction();
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <Card className="w-full max-w-lg mx-4 border border-indigo-500/30 shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Approval Required</CardTitle>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-xl font-semibold">{payload.jobTitle}</p>
            <p className="text-muted-foreground">{payload.company}</p>
          </div>

          {typeof payload.matchScore === "number" && (
            <Badge variant={payload.matchScore >= 80 ? "default" : "secondary"}>
              Match Score: {payload.matchScore}%
            </Badge>
          )}

          {payload.resumePreview && (
            <div className="rounded-lg bg-secondary/50 p-3 text-sm max-h-40 overflow-y-auto">
              <p className="text-muted-foreground text-xs mb-1">
                Resume Preview
              </p>
              <p className="whitespace-pre-wrap">{payload.resumePreview}</p>
            </div>
          )}

          <div className="flex items-center gap-2 text-amber-400 text-sm">
            <Clock className="h-4 w-4" />
            <span>Expires in: {countdown}</span>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleReject}
              disabled={loading}
            >
              Skip
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleApprove}
              disabled={loading}
            >
              <Check className="h-4 w-4" />
              Approve & Apply
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
