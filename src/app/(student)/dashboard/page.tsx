import type { Metadata } from "next";
import { PageWrapper, PageHeader } from "@/components/layout/PageWrapper";
import { LogoutButton } from "@/features/auth/LogoutButton";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function StudentDashboardPage() {
  return (
    <PageWrapper>
      <PageHeader
        title="Dashboard"
        description="Welcome to Placely. Your placement journey starts here."
        action={<LogoutButton />}
      />

      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Student dashboard — placement features will be added in subsequent
          phases.
        </p>
      </div>
    </PageWrapper>
  );
}
