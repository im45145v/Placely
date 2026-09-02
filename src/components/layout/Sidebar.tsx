"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SidebarItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  children?: Omit<SidebarItem, "children">[];
}

interface SidebarProps {
  items: SidebarItem[];
  title?: string;
  className?: string;
}

export function Sidebar({
  items,
  title,
  className,
}: SidebarProps): React.ReactElement {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col gap-1 border-r border-border bg-background px-3 py-4",
        className
      )}
      aria-label={title ?? "Sidebar navigation"}
    >
      {title && (
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}
      <nav aria-label={title ?? "Sidebar"}>
        <ul className="space-y-0.5">
          {items.map((item) => (
            <SidebarNavItem key={item.href} item={item} pathname={pathname} />
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function SidebarNavItem({
  item,
  pathname,
}: {
  item: SidebarItem;
  pathname: string;
}): React.ReactElement {
  const isActive =
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  const [expanded, setExpanded] = useState(isActive);

  const hasChildren = item.children && item.children.length > 0;
  const submenuId = getSubmenuId(item.href);

  if (hasChildren) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isActive
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
          aria-expanded={expanded}
          aria-controls={submenuId}
        >
          {item.icon && <span className="shrink-0">{item.icon}</span>}
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronIcon expanded={expanded} />
        </button>
        {expanded && (
          <ul id={submenuId} className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-3">
            {item.children!.map((child) => (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                    pathname === child.href
                      ? "font-medium text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {child.icon && <span className="shrink-0">{child.icon}</span>}
                  {child.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
        aria-current={isActive ? "page" : undefined}
      >
        {item.icon && <span className="shrink-0">{item.icon}</span>}
        {item.label}
      </Link>
    </li>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("transition-transform", expanded && "rotate-180")}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function getSubmenuId(href: string): string {
  return `sidebar-group-${href.replaceAll(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}
