"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SectionTab {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface SectionTabsProps {
  tabs: SectionTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function SectionTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
}: SectionTabsProps): React.ReactElement {
  return (
    <div
      className={cn(
        "flex items-center border-b border-border",
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
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
