import type { Metadata } from "next";
import { PageWrapper, PageHeader } from "@/components/layout/PageWrapper";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { listSubmittedResumesForAdmin } from "@/lib/resumes/service";
import { AdminResumeReview } from "@/features/admin/AdminResumeReview";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export default async function AdminDashboardPage() {
  const actor = await requireRoleAccess(ADMIN_ROLES);
  const pendingResumes = await listSubmittedResumesForAdmin(actor);

  return (
    <PageWrapper>
      <PageHeader
        title="Admin Dashboard"
        description="Placement management overview and resume verification workflow."
        action={<LogoutButton />}
      />
      <AdminResumeReview initialRecords={pendingResumes} />
    </PageWrapper>
  );
}
