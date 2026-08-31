import type { Metadata } from "next";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { requireStudentAccess } from "@/lib/auth/guards";
import { listApplicationsForStudent } from "@/lib/applications/service";
import { StudentApplicationsView } from "@/features/applications/StudentApplicationsView";

export const metadata: Metadata = {
  title: "Applications",
};

export default async function StudentApplicationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireStudentAccess();
  const params = searchParams ? await searchParams : {};
  const result = await listApplicationsForStudent(actor, {
    search: typeof params.search === "string" ? params.search : undefined,
    status: typeof params.status === "string" ? (params.status as never) : "all",
    page: typeof params.page === "string" ? Number(params.page) : 1,
  });

  return (
    <PageWrapper>
      <PageHeader title="Applications" description="Track your submitted roles, current status, and application timeline." />
      <StudentApplicationsView initialApplications={result} />
    </PageWrapper>
  );
}
