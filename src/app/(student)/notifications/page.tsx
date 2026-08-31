import type { Metadata } from "next";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { requireStudentAccess } from "@/lib/auth/guards";
import { listNotificationsForStudent } from "@/lib/notifications/service";
import { NotificationCenter } from "@/features/notifications/NotificationCenter";

export const metadata: Metadata = {
  title: "Notifications",
};

export default async function NotificationsPage() {
  const actor = await requireStudentAccess();
  const feed = await listNotificationsForStudent(actor, 1);

  return (
    <PageWrapper>
      <PageHeader
        title="Notifications"
        description="Track application events, round updates, reminders, and announcements in one place."
      />
      <NotificationCenter
        initialNotifications={feed.notifications}
        initialUnreadCount={feed.unreadCount}
      />
    </PageWrapper>
  );
}
