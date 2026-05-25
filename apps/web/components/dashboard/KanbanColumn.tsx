"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface KanbanColumnProps {
  title: string;
  count: number;
  variant: "default" | "success" | "warning" | "destructive";
  children: ReactNode;
}

const variantStyles = {
  default: "bg-primary-500/10 text-primary-500",
  success: "bg-green-500/10 text-green-400",
  warning: "bg-amber-500/10 text-amber-400",
  destructive: "bg-red-500/10 text-red-400",
};

export default function KanbanColumn({ title, count, variant, children }: KanbanColumnProps) {
  return (
    <div className="flex-1 min-w-[280px]">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <Badge variant="secondary" className={cn(variantStyles[variant])}>
          {count}
        </Badge>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
