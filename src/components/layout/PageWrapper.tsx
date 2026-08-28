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
    <main
      className={cn(
        "flex-1 overflow-auto",
        className
      )}
    >
      <div className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
        {children}
      </div>
    </main>
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
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
