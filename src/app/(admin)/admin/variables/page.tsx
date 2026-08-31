import type { Metadata } from "next";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { listVariablesForUniversity } from "@/lib/variables/service";
import { AdminVariablesManager } from "@/features/admin/AdminVariablesManager";

export const metadata: Metadata = {
  title: "Admin Variables",
};

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export default async function AdminVariablesPage() {
  const actor = await requireRoleAccess(ADMIN_ROLES);
  const variables = await listVariablesForUniversity(actor);

  return (
    <PageWrapper>
      <PageHeader
        title="Variables"
        description="Manage built-in and custom variables used by eligibility, placement rules, analytics, and notification templates."
      />
      <AdminVariablesManager initialVariables={variables} />
    </PageWrapper>
  );
}
