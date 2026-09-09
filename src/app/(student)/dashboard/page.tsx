import type { Metadata } from "next";
import Link from "next/link";
import { PageWrapper, PageHeader } from "@/components/layout/PageWrapper";
import { requireStudentAccess } from "@/lib/auth/guards";
import { listNotificationsForStudent } from "@/lib/notifications/service";
import { listApplicationsForStudent } from "@/lib/applications/service";
import { getStudentProfileForActor } from "@/lib/student-profile/service";
import { DashboardNotificationsCard } from "@/features/notifications/DashboardNotificationsCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function StudentDashboardPage() {
  const actor = await requireStudentAccess();
  const [notificationFeed, applications, profile] = await Promise.all([
    listNotificationsForStudent(actor, 1),
    listApplicationsForStudent(actor, { page: 1 }),
    getStudentProfileForActor(actor),
  ]);

  const { completionPercentage, isProfileComplete } = profile.profile;
  const activeApplications = applications.total;

  return (
    <PageWrapper>
      <PageHeader
        title="Dashboard"
        description="Your placement journey at a glance."
      />

      {!isProfileComplete && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Your profile is {completionPercentage}% complete
              </p>
              <div
                className="mt-2 h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={completionPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Profile completion"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Complete your profile to unlock personalized role recommendations.
              </p>
            </div>
            <Link
              href="/profile"
              className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Complete profile
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Applications" value={String(activeApplications)} trend="neutral" />
        <MetricCard
          label="Profile completion"
          value={`${completionPercentage}%`}
          trend={isProfileComplete ? "up" : "neutral"}
        />
        <MetricCard label="Unread messages" value={String(notificationFeed.unreadCount)} trend="neutral" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recommended for you</CardTitle>
            <CardDescription>Roles that match your profile</CardDescription>
          </CardHeader>
          <CardContent>
            {isProfileComplete ? (
              <p className="text-sm text-muted-foreground">
                Browse open roles that match your profile.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Complete your profile above to get personalized role recommendations.
              </p>
            )}
            <Link
              href="/roles"
              className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Browse job profiles →
            </Link>
          </CardContent>
        </Card>

        <DashboardNotificationsCard
          notifications={notificationFeed.notifications}
          unreadCount={notificationFeed.unreadCount}
        />
      </div>
    </PageWrapper>
  );
}

