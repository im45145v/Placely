"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  leftWidth?: string;
  className?: string;
}

export function SplitPane({
  left,
  right,
  leftWidth = "40%",
  className,
}: SplitPaneProps): React.ReactElement {
  return (
    <div
      className={cn(
        "flex h-full gap-6",
        className
      )}
    >
      <div
        style={{ width: leftWidth }}
        className="flex flex-col overflow-hidden"
      >
        {left}
      </div>
      <div className="flex-1 overflow-hidden">
        {right}
      </div>
    </div>
  );
}
