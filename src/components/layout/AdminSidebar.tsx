"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface AdminNavLink {
  label: string;
  href: string;
}

interface AdminNavGroup {
  title: string;
  items: AdminNavLink[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/admin/dashboard" }],
  },
  {
    title: "People",
    items: [{ label: "Students", href: "/admin/students" }],
  },
  {
    title: "Recruitment",
    items: [
      { label: "Companies", href: "/admin/companies" },
      { label: "Roles", href: "/admin/roles" },
      { label: "Applications", href: "/admin/applications" },
      { label: "Shortlists", href: "/admin/shortlists" },
      { label: "Rounds", href: "/admin/rounds" },
      { label: "Results", href: "/admin/results" },
      { label: "Eligibility", href: "/admin/eligibility" },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Notifications", href: "/admin/notifications" },
      { label: "Announcements", href: "/admin/announcements" },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Analytics", href: "/admin/analytics" },
      { label: "Reports", href: "/admin/reports" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Variables", href: "/admin/variables" },
      { label: "Import / Export", href: "/admin/import-export" },
      { label: "Documents", href: "/admin/documents" },
      { label: "Audit logs", href: "/admin/audit-logs" },
      { label: "Settings", href: "/admin/settings" },
    ],
  },
];

/**
 * Grouped admin navigation. Replaces a flat 17-item nav bar with labeled
 * categories so admins can scan and find a section instead of hunting.
 */
export function AdminSidebar(): React.ReactElement {
  const pathname = usePathname();

  return (
    <aside
      className="hidden w-60 shrink-0 overflow-y-auto border-r border-border bg-background px-3 py-5 md:block"
      aria-label="Admin navigation"
    >
      <nav className="space-y-5">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
