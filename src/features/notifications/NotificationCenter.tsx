"use client";

import { useRef, useState, useTransition } from "react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Collections } from "@/lib/appwrite/constants";
import { getCollectionRealtimeChannel } from "@/lib/appwrite/realtime";
import { formatDate } from "@/lib/utils";
import type { Notification } from "@/types";

interface NotificationCenterProps {
  initialNotifications: Notification[];
  initialUnreadCount: number;
}

export function NotificationCenter({
  initialNotifications,
  initialUnreadCount,
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isPending, startTransition] = useTransition();
  const refreshInFlightRef = useRef(false);
  const queuedRef = useRef(false);

  async function refreshNotifications(): Promise<void> {
    if (refreshInFlightRef.current) {
      queuedRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const payload = await response.json() as { notifications: Notification[]; unreadCount: number };
      setNotifications(payload.notifications);
      setUnreadCount(payload.unreadCount);
    } finally {
      refreshInFlightRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        void refreshNotifications();
      }
    }
  }

  async function markRead(notificationId: string): Promise<void> {
    const response = await fetch(`/api/notifications/${notificationId}`, { method: "PATCH" });
    if (!response.ok) {
      return;
    }
    setNotifications((current) => current.map((item) => item.$id === notificationId ? { ...item, isRead: true, readAt: new Date().toISOString() } : item));
    setUnreadCount((current) => Math.max(current - 1, 0));
  }

  async function markAllRead(): Promise<void> {
    const response = await fetch("/api/notifications", { method: "PATCH" });
    if (!response.ok) {
      return;
    }
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true, readAt: item.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  useRealtimeSubscription({
    enabled: true,
    channels: [getCollectionRealtimeChannel(Collections.NOTIFICATIONS)],
    onEvent: () => {
      startTransition(() => {
        void refreshNotifications();
      });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Notification Center</CardTitle>
            <CardDescription>{unreadCount} unread notification{unreadCount === 1 ? "" : "s"}</CardDescription>
          </div>
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            disabled={unreadCount === 0 || isPending}
          >
            Mark all read
          </button>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.length === 0 ? (
            <EmptyState title="No notifications yet" description="Application updates, round changes, reminders, and announcements will appear here." className="py-10" />
          ) : (
            notifications.map((notification) => (
              <article
                key={notification.$id}
                className={notification.isRead ? "rounded-lg border border-border bg-background p-4" : "rounded-lg border border-amber-300 bg-amber-50/70 p-4"}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{notification.title}</h3>
                      {!notification.isRead ? <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Unread</span> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{notification.body}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(notification.createdAt, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                  {!notification.isRead ? (
                    <button
                      type="button"
                      onClick={() => void markRead(notification.$id)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
