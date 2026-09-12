import React from "react";
import { cn } from "@/lib/utils";
import type { ApplicationDetail } from "@/lib/applications/types";

const stateDotClass: Record<string, string> = {
  selected: "bg-emerald-500",
  completed: "bg-sky-500",
  active: "bg-amber-500",
  rejected: "bg-rose-500",
  pending: "bg-border",
};

interface ApplicationTimelineProps {
  workflow: ApplicationDetail["workflow"];
  className?: string;
}

/**
 * Vertical round-by-round timeline. Each step is stated in words
 * (round name + state text), never color alone.
 */
export function ApplicationTimeline({
  workflow,
  className,
}: ApplicationTimelineProps): React.ReactElement {
  const activeSequence = workflow.find((entry) => entry.state === "active")?.round.sequence;

  return (
    <ol className={cn("space-y-3", className)}>
      {workflow.map((entry) => {
        const isCurrent = entry.round.sequence === activeSequence;
        return (
          <li
            key={entry.round.$id}
            aria-current={isCurrent ? "step" : undefined}
            className="flex items-start gap-3"
          >
            <span
              aria-hidden="true"
              className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", stateDotClass[entry.state] ?? stateDotClass.pending)}
            />
            <div className="min-w-0">
              <p className={cn("text-sm", isCurrent ? "font-semibold text-foreground" : "font-medium text-foreground")}>
                {entry.round.sequence}. {entry.round.name}
                {isCurrent && <span className="ml-2 text-xs font-normal text-muted-foreground">(current step)</span>}
              </p>
              <p className="text-xs capitalize text-muted-foreground">{entry.state}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}