import type { Metadata } from "next";
import { PageWrapper, PageHeader } from "@/components/layout/PageWrapper";
import { LogoutButton } from "@/features/auth/LogoutButton";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

export default function AdminDashboardPage() {
  return (
    <PageWrapper>
      <PageHeader
        title="Admin Dashboard"
        description="Placement management overview."
        action={<LogoutButton />}
      />

      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Admin dashboard — management features will be added in subsequent phases.
        </p>
      </div>
    </PageWrapper>
  );
}
