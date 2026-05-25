"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

interface BillingStatus {
  plan: string;
  limits: {
    applicationsPerDay: number | null;
  };
  usageToday: {
    applications: number;
  };
}

export function PlanLimitToast() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get("/api/v1/billing/status")
      .then((res) => setStatus(res.data as BillingStatus))
      .catch(() => {});
  }, []);

  if (!status || dismissed) return null;

  const limit = status.limits.applicationsPerDay;
  const used = status.usageToday.applications;

  if (limit === null || limit === undefined) return null;
  if (used < limit) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-amber-300 shadow-lg rounded-lg p-4 max-w-sm animate-slide-in">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">
            You've reached your daily limit ({limit}/day).
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Upgrade to Pro for 50 applications/day.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => (window.location.href = "/pricing")}>
              Upgrade Now
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
