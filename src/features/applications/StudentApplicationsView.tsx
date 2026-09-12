"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { ApplicationTimeline } from "@/components/applications/ApplicationTimeline";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Collections } from "@/lib/appwrite/constants";
import { getCollectionRealtimeChannel } from "@/lib/appwrite/realtime";
import { formatDate } from "@/lib/utils";
import type { ApplicationDetail, PaginatedApplications } from "@/lib/applications/types";

export function StudentApplicationsView({
  initialApplications,
}: {
  initialApplications: PaginatedApplications<ApplicationDetail>;
}) {
  const [applications, setApplications] = useState(initialApplications.items);
  const [total, setTotal] = useState(initialApplications.total);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const channels = useMemo(() => [getCollectionRealtimeChannel(Collections.APPLICATIONS)], []);

  async function refreshApplications(): Promise<void> {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;
    try {
      const response = await fetch("/api/applications", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const next = await response.json() as PaginatedApplications<ApplicationDetail>;
      setApplications(next.items);
      setTotal(next.total);
    } finally {
      refreshInFlightRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        void refreshApplications();
      }
    }
  }

  useRealtimeSubscription({
    enabled: true,
    channels,
    onEvent: () => {
      startTransition(() => {
        void refreshApplications();
      });
    },
  });

  function withdraw(applicationId: string): void {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/applications/${applicationId}/withdraw`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Failed to withdraw application.");
        return;
      }
      setApplications((current) => current.map((item) => (item.$id === applicationId ? data : item)));
      setMessage("Application withdrawn.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My applications</CardTitle>
        <CardDescription>{total} application records</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {applications.map((application) => (
          <div key={application.$id} className="rounded-md border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <Link href={`/applications/${application.$id}`} className="text-sm font-medium text-primary underline">
                  {application.role.title}
                </Link>
                <p className="text-sm text-muted-foreground">{application.company.name}</p>
                <p className="text-xs text-muted-foreground">Applied {formatDate(application.appliedAt)}</p>
                <div className="flex flex-wrap gap-2">
                  <StatusChip variant={statusChipVariant(application.status)}>
                    {application.status}
                  </StatusChip>
                </div>
                <ApplicationTimeline workflow={application.workflow} className="mt-1" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(application.status === "APPLIED" || application.status === "SHORTLISTED") ? (
                  <Button type="button" variant="outline" size="sm" loading={isPending} onClick={() => withdraw(application.$id)}>
                    Withdraw
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {(message || error) ? <p className={error ? "text-sm text-destructive" : "text-sm"}>{error ?? message}</p> : null}
      </CardContent>
    </Card>
  );
}

function statusChipVariant(status: ApplicationDetail["status"]) {
  if (status === "REJECTED") return "rejected";
  if (status === "WITHDRAWN") return "closed";
  if (status === "APPLIED") return "applied";
  if (status === "SHORTLISTED" || status === "SELECTED" || status === "OFFERED" || status === "ACCEPTED") return "eligible";
  return "pending";
}
