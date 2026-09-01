import type { Metadata } from "next";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { AdminImportExportWorkbench } from "@/features/admin/AdminImportExportWorkbench";

export const metadata: Metadata = {
  title: "Admin Import Export",
};

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export default async function AdminImportExportPage() {
  await requireRoleAccess(ADMIN_ROLES);

  return (
    <PageWrapper>
      <PageHeader
        title="Import and Export"
        description="Server-side CSV and Excel-friendly TSV workflows for students, companies, roles, shortlists, results, and interview schedules."
      />
      <AdminImportExportWorkbench />
    </PageWrapper>
  );
}
