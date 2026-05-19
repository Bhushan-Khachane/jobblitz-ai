"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  User,
  Search,
  Briefcase,
  BarChart3,
  CreditCard,
  Zap,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Link2,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "My Profile", icon: User },
  { href: "/portals", label: "Portals", icon: Link2 },
  { href: "/discovery", label: "Discovery", icon: Search },
  { href: "/review-jobs", label: "Review Jobs", icon: ClipboardCheck },
  { href: "/applications", label: "Applications", icon: Briefcase },
  { href: "/approval-queue", label: "Approval Queue", icon: Bell, badge: true },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const mobileOpen = isOpen ?? false;
  const closeMobile = onClose ?? (() => {});

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { data } = await api.get("/applications/me/approval-queue");
        setQueueCount((data || []).length);
      } catch {
        // ignore
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={closeMobile} />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-[#080810] border-r border-white/5 transition-all duration-300 flex flex-col",
          collapsed ? "w-[72px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center gap-2 px-5 py-5 border-b border-white/5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0 glow-indigo">
            <Zap className="w-5 h-5 text-white" />
          </div>
          {!collapsed && <span className="text-lg font-bold text-white">JobBlitz</span>}
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname === item.href;
            const count = item.badge ? queueCount : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => closeMobile()}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-indigo-500/15 text-indigo-300 border-l-2 border-indigo-500"
                    : "text-white/40 hover:text-white/80 hover:bg-white/5"
                )}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", active ? "text-indigo-400" : "text-white/30")} />
                {!collapsed && (
                  <span className="flex-1 flex items-center justify-between"
                  >
                    <span>{item.label}</span>
                    {count > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-red-500/80 text-white rounded-full min-w-[18px] text-center"
                      >
                        {count}
                      </span>
                    )}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center p-3 border-t border-white/5 text-white/30 hover:text-white/60"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </aside>
    </>
  );
}
