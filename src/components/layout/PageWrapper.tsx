import React from "react";
import { cn } from "@/lib/utils";

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps page content with consistent padding and max-width.
 */
export function PageWrapper({
  children,
  className,
}: PageWrapperProps): React.ReactElement {
  return (
    <div
      className={cn(
        "w-full px-6 py-6 md:px-8",
        className
      )}
    >
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Consistent page-level heading with optional description and action slot.
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: PageHeaderProps): React.ReactElement {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-8", className)}>
      <div className="flex-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
