import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import type { Notification } from "@/types";

export function DashboardNotificationsCard({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>{unreadCount} unread notification{unreadCount === 1 ? "" : "s"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          notifications.slice(0, 5).map((notification) => (
            <div key={notification.$id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{notification.title}</p>
                {!notification.isRead ? <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-label="Unread notification" /> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{formatDate(notification.createdAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
            </div>
          ))
        )}
        <Link href="/notifications" className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline">
          Open notification center
        </Link>
      </CardContent>
    </Card>
  );
}
