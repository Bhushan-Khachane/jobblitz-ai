import { Suspense } from "react";
import OnboardingClient from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingClient />
    </Suspense>
  );
}