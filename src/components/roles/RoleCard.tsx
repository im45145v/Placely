import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCtc, formatDate } from "@/lib/utils";
import type { RoleDetail } from "@/lib/companies/service";

interface RoleCardProps {
  role: RoleDetail;
  href: string;
  selected?: boolean;
  className?: string;
}

export function RoleCard({
  role,
  href,
  selected,
  className,
}: RoleCardProps): React.ReactElement {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "block rounded-md border border-transparent p-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "motion-safe:transition-all motion-safe:duration-150 motion-reduce:transition-none",
        selected ? "border-primary bg-accent/20" : "hover:bg-accent/10",
        className
      )}
    >
      <h3 className="text-xs font-semibold text-foreground line-clamp-2">{role.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{role.company.name}</p>
      <div className="mt-2 flex items-center justify-between">
        {role.ctc && (
          <span className="text-xs font-medium text-foreground">{formatCtc(role.ctc)}</span>
        )}
        {role.applicationDeadline && (
          <span className="text-xs text-muted-foreground">
            Due {formatDate(role.applicationDeadline)}
          </span>
        )}
      </div>
    </Link>
  );
}
