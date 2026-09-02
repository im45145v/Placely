import React from "react";
import { cn } from "@/lib/utils";

export type StatusChipVariant = 
  | "eligible" 
  | "not-eligible" 
  | "applied" 
  | "closed" 
  | "pending" 
  | "completed" 
  | "rejected";

interface StatusChipProps {
  variant: StatusChipVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<StatusChipVariant, string> = {
  eligible: "bg-green-50 text-green-700 border border-green-200",
  "not-eligible": "bg-red-50 text-red-700 border border-red-200",
  applied: "bg-blue-50 text-blue-700 border border-blue-200",
  closed: "bg-gray-50 text-gray-700 border border-gray-200",
  pending: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  completed: "bg-green-50 text-green-700 border border-green-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
};

export function StatusChip({
  variant,
  children,
  className,
}: StatusChipProps): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
