"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Collections } from "@/lib/appwrite/constants";
import { getApplicationRealtimeChannels, getDocumentRealtimeChannel } from "@/lib/appwrite/realtime";
import { formatDate } from "@/lib/utils";
import type { ApplicationDetail } from "@/lib/applications/types";

export function StudentApplicationDetailView({
  initialApplication,
}: {
  initialApplication: ApplicationDetail;
}) {
  const [application, setApplication] = useState(initialApplication);
  const [, startTransition] = useTransition();
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);

  async function refreshApplication(): Promise<void> {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;
    try {
      const response = await fetch(`/api/applications/${application.$id}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const next = await response.json() as ApplicationDetail;
      setApplication(next);
    } finally {
      refreshInFlightRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        void refreshApplication();
      }
    }
  }

  const channels = useMemo(() => [
    ...getApplicationRealtimeChannels(application.$id),
    ...application.workflow.map((entry) => getDocumentRealtimeChannel(Collections.PLACEMENT_ROUNDS, entry.round.$id)),
    ...application.workflow.flatMap((entry) => {
      const scoped: string[] = [];
      if (entry.participant) {
        scoped.push(getDocumentRealtimeChannel(Collections.ROUND_PARTICIPANTS, entry.participant.$id));
      }
      if (entry.result) {
        scoped.push(getDocumentRealtimeChannel(Collections.RESULTS, entry.result.$id));
      }
      return scoped;
    }),
  ], [application.$id, application.workflow]);

  useRealtimeSubscription({
    enabled: channels.length > 0,
    channels,
    onEvent: () => {
      startTransition(() => {
        void refreshApplication();
      });
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Round-by-round application progress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border p-4">
            <div className="flex flex-wrap gap-3">
              {application.workflow.map((entry) => (
                <div key={entry.round.$id} className="min-w-44 flex-1 rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{entry.round.sequence}. {entry.round.name}</p>
                    <span className={timelinePillClass(entry.state)}>{entry.state}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.round.type.replaceAll("_", " ")}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {entry.participant?.scheduledStart
                      ? `Scheduled ${formatDate(entry.participant.scheduledStart, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${entry.participant.scheduledEnd ? ` to ${formatDate(entry.participant.scheduledEnd, { hour: "numeric", minute: "2-digit" })}` : ""}`
                      : entry.round.startTime
                        ? `Starts ${formatDate(entry.round.startTime, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                        : "Schedule pending"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.participant?.scheduleStatus === "cancelled"
                      ? `Interview cancelled${entry.participant.cancellationReason ? `: ${entry.participant.cancellationReason}` : ""}`
                      : entry.participant?.room
                        ? `Room ${entry.participant.room}`
                        : entry.participant?.location ?? entry.round.location ?? entry.participant?.meetingLink ?? entry.round.meetingLink ?? "Location or link will appear here."}
                  </p>
                  {entry.participant?.scheduleTimezone ? <p className="mt-1 text-xs text-muted-foreground">Timezone: {entry.participant.scheduleTimezone}</p> : null}
                  <p className="mt-2 text-xs">{entry.participant?.instructions ?? entry.round.instructions ?? "No instructions published yet."}</p>
                  {entry.result?.publishedAt ? <p className="mt-2 text-xs font-medium">Published result: {entry.result.outcome}</p> : null}
                </div>
              ))}
            </div>
          </div>
          {application.timeline.map((entry) => (
            <div key={entry.$id} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{entry.action}</p>
              <p className="text-xs text-muted-foreground">{formatDate(entry.timestamp, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>Current application summary</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p><strong>Status:</strong> {application.status}</p>
          <p><strong>Current round:</strong> {application.currentRound?.round.name ?? "Not assigned yet"}</p>
          <p><strong>Applied:</strong> {formatDate(application.appliedAt)}</p>
          <p><strong>Last changed:</strong> {formatDate(application.lastStatusChangedAt)}</p>
          {application.withdrawnAt ? <p><strong>Withdrawn:</strong> {formatDate(application.withdrawnAt)}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function timelinePillClass(state: string): string {
  if (state === "selected") return "rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700";
  if (state === "completed") return "rounded-full bg-sky-100 px-2 py-1 text-[11px] font-medium text-sky-700";
  if (state === "active") return "rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700";
  if (state === "rejected") return "rounded-full bg-rose-100 px-2 py-1 text-[11px] font-medium text-rose-700";
  return "rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground";
}
