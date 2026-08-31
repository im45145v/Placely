import type { Metadata } from "next";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { StudentApplicationDetailView } from "@/features/applications/StudentApplicationDetailView";
import { requireStudentAccess } from "@/lib/auth/guards";
import { getStudentApplicationDetail } from "@/lib/applications/service";

export const metadata: Metadata = {
  title: "Application",
};

export default async function StudentApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const actor = await requireStudentAccess();
  const { applicationId } = await params;
  const application = await getStudentApplicationDetail(actor, applicationId);

  return (
    <PageWrapper>
      <PageHeader title={application.role.title} description={`${application.company.name} • ${application.status}`} />
      <StudentApplicationDetailView initialApplication={application} />
    </PageWrapper>
  );
}
