"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface StudentSidebarItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface StudentSidebarProps {
  items: StudentSidebarItem[];
}

export function StudentSidebar({
  items,
}: StudentSidebarProps): React.ReactElement {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-border bg-background" aria-label="Student navigation">
      <nav className="flex flex-col gap-1 p-4" aria-label="Student sidebar">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
