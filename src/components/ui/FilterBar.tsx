"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterBar({
  children,
  className,
}: FilterBarProps): React.ReactElement {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3",
        className
      )}
    >
      {children}
    </div>
  );
}

interface FilterInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function FilterInput({
  label,
  className,
  ...props
}: FilterInputProps): React.ReactElement {
  return (
    <input
      {...props}
      className={cn(
        "rounded-md border border-input bg-background px-3 py-2 text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
        className
      )}
    />
  );
}

interface FilterSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function FilterSelect({
  label,
  className,
  children,
  ...props
}: FilterSelectProps): React.ReactElement {
  return (
    <select
      {...props}
      className={cn(
        "rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
        className
      )}
    >
      {children}
    </select>
  );
}

interface FilterButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function FilterButton({
  variant = "secondary",
  className,
  children,
  ...props
}: FilterButtonProps): React.ReactElement {
  return (
    <button
      {...props}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium transition-colors",
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-border bg-background text-foreground hover:bg-accent",
        className
      )}
    >
      {children}
    </button>
  );
}
