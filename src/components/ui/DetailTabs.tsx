"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface DetailTab {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface DetailTabsProps {
  tabs: DetailTab[];
  activeTab: string;
  className?: string;
}

export function DetailTabs({
  tabs,
  activeTab,
  className,
}: DetailTabsProps): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", tabId);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number): void => {
    if (tabs.length === 0) {
      return;
    }

    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    if (!nextTab) {
      return;
    }
    handleTabChange(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      className={cn(
        "flex items-center border-b border-border",
        className
      )}
      role="tablist"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => {
            tabRefs.current[index] = element;
          }}
          type="button"
          onClick={() => handleTabChange(tab.id)}
          onKeyDown={(event) => handleTabKeyDown(event, index)}
          role="tab"
          aria-selected={activeTab === tab.id}
          tabIndex={activeTab === tab.id ? 0 : -1}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === tab.id
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1 text-xs opacity-60">({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}
