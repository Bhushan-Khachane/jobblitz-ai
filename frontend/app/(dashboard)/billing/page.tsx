"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, Check, Zap, Crown, Building2, ArrowRight, AlertTriangle, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import api from "@/lib/api";

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    icon: Zap,
    features: ["10 applications/day", "1 job search", "Basic matching", "Email support"],
    current: false,
    dailyLimit: 10,
  },
  {
    name: "Starter",
    price: "₹499",
    period: "/month",
    icon: Rocket,
    features: ["25 applications/day", "LinkedIn + Naukri", "AI resume tailoring", "Cover letter generation", "Email support"],
    current: false,
    dailyLimit: 25,
  },
  {
    name: "Pro",
    price: "₹999",
    period: "/month",
    icon: Crown,
    features: ["50 applications/day", "All platforms", "Priority browser pool", "AI resume + cover letter", "Advanced analytics", "Priority support"],
    current: false,
    dailyLimit: 50,
  },
  {
    name: "Unlimited",
    price: "₹1,999",
    period: "/month",
    icon: Building2,
    features: ["100 applications/day", "All platforms", "Dedicated browser pool", "Everything in Pro", "Custom integrations", "SLA guarantee"],
    current: false,
    dailyLimit: 100,
  },
];

const tierDailyLimits: Record<string, number> = {
  free: 10,
  starter: 25,
  pro: 50,
  unlimited: 100,
};

export default function BillingPage() {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState("Free");
  const [usedApps, setUsedApps] = useState(0);
  const [maxApps, setMaxApps] = useState(10);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const userRes = await api.get("/users/me");
        const user = userRes.data;
        const planName = (user.plan || "free").charAt(0).toUpperCase() + (user.plan || "free").slice(1);
        setCurrentPlan(planName);
        setMaxApps(tierDailyLimits[user.plan || "free"] || 10);

        const appsRes = await api.get("/applications/", { params: { page_size: 1 } }).catch(() => ({ data: { total: 0 } }));
        setUsedApps(appsRes.data.total || 0);
      } catch {
        // defaults are fine
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground">Billing</h1>

      {/* Current Plan */}
      <Card className="border-primary-500/30 bg-primary-500/5">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-foreground">{currentPlan} Plan</h2>
                <Badge className="bg-primary-500/15 text-primary-500">Current</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{maxApps} applications per day</p>
            </div>
            {currentPlan !== "Unlimited" && (
              <Button>
                Upgrade <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Applications used today</span>
              <span className="text-sm text-muted-foreground">{usedApps} / {maxApps}</span>
            </div>
            <Progress value={Math.min((usedApps / maxApps) * 100, 100)} className="h-2" />
            {usedApps >= maxApps && (
              <p className="flex items-center gap-1 text-xs text-amber-600 mt-2">
                <AlertTriangle className="w-3 h-3" /> Daily limit reached. Upgrade for more.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.name === currentPlan;
          const isPopular = plan.name === "Pro";
          return (
            <Card key={plan.name} className={`relative ${isCurrent ? "border-primary-500 ring-2 ring-primary-500/10" : isPopular ? "border-primary-500 ring-2 ring-primary-500/20" : ""}`}>
              {isPopular && !isCurrent && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-primary-foreground">Most Popular</Badge>
              )}
              <CardHeader className="text-center pb-4">
                <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center mx-auto mb-2">
                  <plan.icon className="w-5 h-5 text-primary-500" />
                </div>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div>
                  <span className="text-2xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                ) : (
                  <Button variant={isPopular ? "default" : "outline"} className="w-full">
                    {plan.name === "Unlimited" ? "Contact Sales" : "Upgrade"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Separator />

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>Your recent invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Description</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">No invoices yet</td>
                  </tr>
                ) : (
                  invoices.map((inv: any) => (
                    <tr key={inv.id} className="border-b border-border">
                      <td className="py-3 px-2 text-muted-foreground">
                        {new Date(inv.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-3 px-2 text-foreground">{inv.description}</td>
                      <td className="py-3 px-2 font-medium text-foreground">{inv.amount}</td>
                      <td className="py-3 px-2">
                        <Badge variant="secondary" className="bg-green-500/15 text-green-400">
                          {inv.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cancel */}
      {currentPlan !== "Free" && (
        <Card className="border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Cancel Subscription</h3>
                <p className="text-sm text-muted-foreground">You&apos;ll be downgraded to the Free plan at the end of your billing period.</p>
              </div>
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                Cancel Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure? Your access will continue until the end of the billing period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>Keep Plan</Button>
            <Button variant="destructive">Yes, Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
