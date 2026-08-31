import type { Metadata } from "next";
import { PageWrapper, PageHeader } from "@/components/layout/PageWrapper";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { requireStudentAccess } from "@/lib/auth/guards";
import { listNotificationsForStudent } from "@/lib/notifications/service";
import { DashboardNotificationsCard } from "@/features/notifications/DashboardNotificationsCard";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function StudentDashboardPage() {
  const actor = await requireStudentAccess();
  const notificationFeed = await listNotificationsForStudent(actor, 1);

  return (
    <PageWrapper>
      <PageHeader
        title="Dashboard"
        description="Welcome to Placely. Your placement journey starts here."
        action={<LogoutButton />}
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Student dashboard — placement features will be added in subsequent phases.
          </p>
        </div>
        <DashboardNotificationsCard
          notifications={notificationFeed.notifications}
          unreadCount={notificationFeed.unreadCount}
        />
      </div>
    </PageWrapper>
  );
}
