import React from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function MetricCard({
  label,
  value,
  icon,
  trend,
  className,
}: MetricCardProps): React.ReactElement {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
        </div>
        {icon && (
          <div className="mt-1 text-muted-foreground">{icon}</div>
        )}
      </div>
      {trend && (
        <div className="mt-2 text-xs text-muted-foreground">
          {trend === "up" && "↑ Trending up"}
          {trend === "down" && "↓ Trending down"}
          {trend === "neutral" && "→ No change"}
        </div>
      )}
    </div>
  );
}
