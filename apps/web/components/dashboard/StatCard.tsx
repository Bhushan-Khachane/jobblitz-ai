import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  change?: string;
  changeType?: "up" | "down" | "neutral";
  href?: string;
}

export default function StatCard({ title, value, icon: Icon, iconColor, change, changeType, href }: StatCardProps) {
  const card = (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border border-white/5 bg-[#0d0d14] p-5 hover:border-indigo-500/20 transition-all group",
      href && "cursor-pointer hover:scale-[1.02]"
    )}>
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-2">{title}</p>
          <p className="text-3xl font-black text-white">{value}</p>
          {change && (
            <p className={cn("text-xs mt-2 font-medium",
              changeType === "up" ? "text-green-400" :
              changeType === "down" ? "text-red-400" : "text-white/30"
            )}>{change}</p>
          )}
        </div>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconColor || "bg-indigo-500/15 text-indigo-400")}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}