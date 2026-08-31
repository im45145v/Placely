"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Collections } from "@/lib/appwrite/constants";
import { getCollectionRealtimeChannel } from "@/lib/appwrite/realtime";
import { formatDate } from "@/lib/utils";
import type { Announcement } from "@/types";

export function ImportantAnnouncementsFeed({
  initialAnnouncements,
}: {
  initialAnnouncements: Announcement[];
}) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [isPending, startTransition] = useTransition();
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const channels = useMemo(() => [getCollectionRealtimeChannel(Collections.ANNOUNCEMENTS)], []);

  async function refreshAnnouncements(): Promise<void> {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;

    try {
      const response = await fetch("/api/announcements", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const next = await response.json() as Announcement[];
      setAnnouncements(next);
    } finally {
      refreshInFlightRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        void refreshAnnouncements();
      }
    }
  }

  useRealtimeSubscription({
    enabled: true,
    channels,
    onEvent: () => {
      startTransition(() => {
        void refreshAnnouncements();
      });
    },
  });

  if (announcements.length === 0 && !isPending) {
    return null;
  }

  return (
    <section className="border-b border-amber-200 bg-amber-50 text-amber-950">
      <div className="container mx-auto space-y-2 px-4 py-3">
        {announcements.map((announcement) => (
          <article key={announcement.$id} className="rounded-md border border-amber-200 bg-white/70 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{announcement.title}</p>
              <p className="text-xs text-amber-800">
                {formatDate(announcement.publishedAt, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
            <p className="mt-1 text-sm">{announcement.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
