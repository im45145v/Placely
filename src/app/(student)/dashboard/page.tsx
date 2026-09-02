import type { Metadata } from "next";
import Link from "next/link";
import { PageWrapper, PageHeader } from "@/components/layout/PageWrapper";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { requireStudentAccess } from "@/lib/auth/guards";
import { listNotificationsForStudent } from "@/lib/notifications/service";
import { DashboardNotificationsCard } from "@/features/notifications/DashboardNotificationsCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

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
        description="Your placement journey at a glance."
        action={<LogoutButton />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr_1fr]">
        <MetricCard
          label="Applications"
          value="0"
          trend="neutral"
        />
        <MetricCard
          label="Active Profiles"
          value="0"
          trend="neutral"
        />
        <MetricCard
          label="Messages"
          value="0"
          trend="neutral"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recommended for you</CardTitle>
            <CardDescription>Roles that match your profile</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Complete your profile to get personalized role recommendations.
            </p>
            <Link
              href="/profile"
              className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Complete Profile
            </Link>
          </CardContent>
        </Card>

        <DashboardNotificationsCard
          notifications={notificationFeed.notifications}
          unreadCount={notificationFeed.unreadCount}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
          <CardDescription>Begin your placement journey</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link
            href="/profile"
            className="block rounded-md border border-border bg-card p-3 transition-colors hover:bg-accent/10"
          >
            <p className="text-sm font-medium">1. Complete your profile</p>
            <p className="text-xs text-muted-foreground">Add your education, skills, and experience</p>
          </Link>
          <Link
            href="/roles"
            className="block rounded-md border border-border bg-card p-3 transition-colors hover:bg-accent/10"
          >
            <p className="text-sm font-medium">2. Browse job profiles</p>
            <p className="text-xs text-muted-foreground">Find roles that match your interests</p>
          </Link>
          <Link
            href="/applications"
            className="block rounded-md border border-border bg-card p-3 transition-colors hover:bg-accent/10"
          >
            <p className="text-sm font-medium">3. Track your applications</p>
            <p className="text-xs text-muted-foreground">Manage and monitor your progress</p>
          </Link>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
