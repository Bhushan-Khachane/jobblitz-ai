"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PLANS } from "@jobblitz/config";
import api from "@/lib/api";

type BillingCycle = "monthly" | "annual";

interface BillingStatus {
  plan: string;
}

export default function PricingPage() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/api/v1/billing/status")
      .then((res) => setCurrentPlan((res.data as BillingStatus).plan))
      .catch(() => {});
  }, []);

  const handleCheckout = async (plan: string) => {
    setLoading(true);
    try {
      const { data } = await api.post("/api/v1/billing/create-checkout-session", {
        plan,
        billing: cycle,
      });
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert("Failed to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    { key: "free", config: PLANS.free, cta: "Get Started", popular: false },
    { key: "pro", config: PLANS.pro, cta: "Upgrade to Pro", popular: true },
    { key: "elite", config: PLANS.elite, cta: "Go Elite", popular: false },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            Choose Your Plan
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            JobBlitz-AI helps you land your dream job faster. Pick the plan that fits your ambition.
          </p>

          <div className="flex items-center justify-center gap-3 pt-2">
            <span className={`text-sm ${cycle === "monthly" ? "text-gray-900 font-medium" : "text-gray-500"}`}>
              Monthly
            </span>
            <Switch
              checked={cycle === "annual"}
              onCheckedChange={(checked) => setCycle(checked ? "annual" : "monthly")}
            />
            <span className={`text-sm ${cycle === "annual" ? "text-gray-900 font-medium" : "text-gray-500"}`}>
              Annual
            </span>
            <Badge variant="secondary" className="bg-teal-100 text-teal-800">
              2 months free
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(({ key, config, cta, popular }) => {
            const isCurrent = currentPlan === key;
            const price = cycle === "monthly"
              ? config.priceMonthlyUsd
              : config.priceYearlyUsd;

            return (
              <Card
                key={key}
                className={`relative overflow-hidden ${popular ? "border-teal-500 border-2 shadow-lg" : ""}`}
              >
                {popular && (
                  <div className="absolute top-0 right-0 bg-teal-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                    MOST POPULAR
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{config.name}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">
                      {price === 0 ? "Free" : `$${price}`}
                    </span>
                    {price > 0 && (
                      <span className="text-gray-500 text-sm">
                        /{cycle === "monthly" ? "mo" : "yr"}
                      </span>
                    )}
                  </div>
                  {isCurrent && (
                    <Badge className="bg-teal-100 text-teal-800 w-fit mt-2">
                      Current Plan
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {config.features.map((feature: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <svg className="h-5 w-5 text-teal-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full ${popular ? "bg-teal-600 hover:bg-teal-700" : ""}`}
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || loading}
                    onClick={() => handleCheckout(key)}
                  >
                    {isCurrent ? "Current Plan" : cta}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center text-sm text-gray-500 pt-4">
          Prices shown in USD. INR pricing available at checkout for Indian users.
        </div>
      </div>
    </div>
  );
}
