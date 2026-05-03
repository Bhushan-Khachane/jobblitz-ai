"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Check, Zap, Crown, Building2, ArrowRight, AlertTriangle } from "lucide-react";
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

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    icon: Zap,
    features: ["5 applications/day", "1 job search", "Basic analytics"],
    current: true,
  },
  {
    name: "Pro",
    price: "₹999",
    period: "/month",
    icon: Crown,
    features: ["Unlimited applications", "Unlimited searches", "AI resume tailoring", "Cover letters", "Priority support"],
    current: false,
  },
  {
    name: "Business",
    price: "Custom",
    period: "",
    icon: Building2,
    features: ["Everything in Pro", "Multi-user", "API access", "Dedicated manager"],
    current: false,
  },
];

const mockBilling = [
  { id: "1", date: "2026-04-01", amount: "₹0", description: "Free Plan", status: "paid" },
  { id: "2", date: "2026-03-01", amount: "₹0", description: "Free Plan", status: "paid" },
  { id: "3", date: "2026-02-01", amount: "₹0", description: "Free Plan", status: "paid" },
];

export default function BillingPage() {
  const [cancelOpen, setCancelOpen] = useState(false);
  const usedApps = 3; // mock
  const maxApps = 5; // free tier

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Billing</h1>

      {/* Current Plan */}
      <Card className="border-indigo-200 bg-indigo-50/50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-gray-900">Free Plan</h2>
                <Badge className="bg-indigo-100 text-indigo-700">Current</Badge>
              </div>
              <p className="text-sm text-gray-600">5 applications per day · 1 job search</p>
            </div>
            <Button>
              Upgrade to Pro <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Applications used today</span>
              <span className="text-sm text-gray-500">{usedApps} / {maxApps}</span>
            </div>
            <Progress value={(usedApps / maxApps) * 100} className="h-2" />
            {usedApps >= maxApps && (
              <p className="flex items-center gap-1 text-xs text-amber-600 mt-2">
                <AlertTriangle className="w-3 h-3" /> Daily limit reached. Upgrade for unlimited.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.name} className={plan.current ? "border-indigo-600 ring-2 ring-indigo-600/10" : ""}>
            <CardHeader className="text-center pb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-2">
                <plan.icon className="w-5 h-5 text-indigo-600" />
              </div>
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              <div>
                <span className="text-2xl font-bold">{plan.price}</span>
                <span className="text-gray-500 text-sm">{plan.period}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {!plan.current && (
                <Button variant={plan.name === "Pro" ? "default" : "outline"} className="w-full">
                  {plan.name === "Business" ? "Contact Sales" : "Upgrade"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
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
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Date</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Description</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Amount</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockBilling.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-50">
                    <td className="py-3 px-2 text-gray-600">
                      {new Date(inv.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3 px-2 text-gray-700">{inv.description}</td>
                    <td className="py-3 px-2 font-medium text-gray-900">{inv.amount}</td>
                    <td className="py-3 px-2">
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        {inv.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cancel */}
      <Card className="border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Cancel Subscription</h3>
              <p className="text-sm text-gray-500">You&apos;re on the Free plan — nothing to cancel!</p>
            </div>
            <Button variant="destructive" disabled>
              Cancel Plan
            </Button>
          </div>
        </CardContent>
      </Card>

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
