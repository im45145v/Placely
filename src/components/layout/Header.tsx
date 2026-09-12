"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/layout/UserMenu";

interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface HeaderProps {
  navItems?: NavItem[];
  /** Grouped nav rendered in the mobile menu instead of a flat navItems list (e.g. admin categories). */
  mobileNavGroups?: NavGroup[];
  /** Show the desktop horizontal nav bar. Set false when a sidebar already covers navigation (e.g. admin). Mobile menu still uses navItems. */
  showDesktopNav?: boolean;
  userDisplayName?: string;
  userSubtitle?: string;
  profileHref?: string;
  logo?: React.ReactNode;
}

export function Header({
  navItems,
  mobileNavGroups,
  showDesktopNav = true,
  userDisplayName,
  userSubtitle,
  profileHref,
  logo,
}: HeaderProps): React.ReactElement {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Escape closes the mobile menu and returns focus to the toggle.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        mobileToggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  function toggleMobileMenu(): void {
    setMobileMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        // Move focus into the menu once it renders.
        queueMicrotask(() => {
          document
            .querySelector<HTMLElement>('[aria-label="Mobile navigation"] a')
            ?.focus();
        });
      }
      return next;
    });
  }

  const isActiveHref = (href: string): boolean =>
    pathname != null && (pathname === href || pathname.startsWith(`${href}/`));
  const hasMobileNav = (mobileNavGroups && mobileNavGroups.length > 0) || (navItems && navItems.length > 0);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-primary">
          {logo ?? (
            <span className="text-lg font-bold tracking-tight">
              Place<span className="text-accent-foreground">ly</span>
            </span>
          )}
        </Link>

        {/* Desktop nav */}
        {showDesktopNav && navItems && navItems.length > 0 && (
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActiveHref(item.href)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Right side: user menu and mobile menu */}
        <div className="flex items-center gap-3">
          {userDisplayName && (
            <UserMenu name={userDisplayName} subtitle={userSubtitle} profileHref={profileHref} />
          )}

          {/* Mobile menu toggle */}
          {hasMobileNav && (
            <button
              ref={mobileToggleRef}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent md:hidden"
              onClick={toggleMobileMenu}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <XIcon />
              ) : (
                <MenuIcon />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && hasMobileNav && (
        <nav
          className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-border bg-background px-4 pb-4 md:hidden"
          aria-label="Mobile navigation"
        >
          {mobileNavGroups && mobileNavGroups.length > 0 ? (
            <div className="mt-2 space-y-4">
              {mobileNavGroups.map((group) => (
                <div key={group.title}>
                  <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </p>
                  <ul className="space-y-1">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                            isActiveHref(item.href)
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="mt-2 space-y-1">
              {navItems!.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      isActiveHref(item.href)
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>
      )}
    </header>
  );
}

function MenuIcon(): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function XIcon(): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
