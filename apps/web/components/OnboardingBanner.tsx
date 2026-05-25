"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

export function OnboardingBanner() {
  const router = useRouter();
  const [step, setStep] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api
      .get("/users/me/profile")
      .then((res) => {
        const s = (res.data as { onboarding_step?: number }).onboarding_step;
        if (s !== undefined && s !== null && s < 5) {
          setStep(s);
        }
      })
      .catch(() => {});
  }, []);

  if (dismissed || step === null) return null;

  const stepLabels: Record<number, string> = {
    0: "Upload your resume",
    1: "Set your target roles",
    2: "Connect job portals",
    3: "Configure preferences",
    4: "Run first discovery",
  };

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          Complete onboarding to start applying
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Next step: {stepLabels[step] || "Finish setup"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90"
          onClick={() => router.push("/onboarding")}
        >
          Continue <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground p-1"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
