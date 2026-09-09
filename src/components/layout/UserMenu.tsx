"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { logout } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  name: string;
  subtitle?: string;
  profileHref?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/**
 * Persistent user menu shown in the header on every authenticated page.
 * Keeps sign-out discoverable at all times instead of buried in per-page actions.
 *
 * Implemented as a disclosure (not an ARIA `menu`) since it holds plain navigable
 * links/buttons — this avoids the roving-tabindex/arrow-key contract a `role="menu"`
 * would otherwise require.
 */
export function UserMenu({ name, subtitle, profileHref }: UserMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const linkItemRef = useRef<HTMLAnchorElement>(null);
  const buttonItemRef = useRef<HTMLButtonElement>(null);

  function close(returnFocus: boolean): void {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") close(true);
    }
    function handleFocusOut(event: FocusEvent): void {
      const next = event.relatedTarget as Node | null;
      if (containerRef.current && (!next || !containerRef.current.contains(next))) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    containerRef.current?.addEventListener("focusout", handleFocusOut);
    (linkItemRef.current ?? buttonItemRef.current)?.focus();

    const container = containerRef.current;
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      container?.removeEventListener("focusout", handleFocusOut);
    };
  }, [open]);

  function handleLogout(): void {
    close(false);
    startTransition(async () => {
      await logout(); // redirects to /login; nothing below this line runs
    });
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          aria-hidden="true"
        >
          {getInitials(name)}
        </span>
        <span className="hidden max-w-[10rem] truncate sm:inline">{name}</span>
        <ChevronDownIcon />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-md border border-border bg-background py-1 shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>

          {profileHref && (
            <Link
              ref={linkItemRef}
              href={profileHref}
              onClick={() => close(false)}
              className="block px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:bg-accent"
            >
              View profile
            </Link>
          )}

          <button
            ref={!profileHref ? buttonItemRef : undefined}
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-700 transition-colors hover:bg-accent focus:outline-none focus-visible:bg-accent disabled:opacity-60 dark:text-red-400"
            )}
          >
            {isPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

function ChevronDownIcon(): React.ReactElement {
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
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

