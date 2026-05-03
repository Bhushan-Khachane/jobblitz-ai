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
  default: "bg-indigo-50 text-indigo-700",
  success: "bg-green-50 text-green-700",
  warning: "bg-yellow-50 text-yellow-700",
  destructive: "bg-red-50 text-red-700",
};

export default function KanbanColumn({ title, count, variant, children }: KanbanColumnProps) {
  return (
    <div className="flex-1 min-w-[280px]">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <Badge variant="secondary" className={cn(variantStyles[variant])}>
          {count}
        </Badge>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
