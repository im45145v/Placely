import type { Metadata } from "next";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { listApplicationsForAdmin, listPlacementRoundsForAdmin } from "@/lib/applications/service";
import { AdminApplicationsManager } from "@/features/applications/AdminApplicationsManager";
import { listRolesForAdmin } from "@/lib/companies/service";
import { listVariablesForUniversity } from "@/lib/variables/service";
import type { RuleNode } from "@/types";

export const metadata: Metadata = {
  title: "Admin Applications",
};

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireRoleAccess(ADMIN_ROLES);
  const params = searchParams ? await searchParams : {};
  const search = typeof params.search === "string" ? params.search : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const roleId = typeof params.roleId === "string" ? params.roleId : "";
  const companyId = typeof params.companyId === "string" ? params.companyId : "";
  const page = typeof params.page === "string" ? Number(params.page) : 1;
  const studentFilter = parseRuleNode(typeof params.studentFilter === "string" ? params.studentFilter : undefined);
  const [applications, rounds, variables, roles] = await Promise.all([
    listApplicationsForAdmin(actor, { search, status: status as never, roleId: roleId || undefined, companyId: companyId || undefined, studentFilter, page }),
    listPlacementRoundsForAdmin(actor, roleId || undefined),
    listVariablesForUniversity(actor),
    listRolesForAdmin(actor, { status: "all", page: 1 }),
  ]);

  return (
    <PageWrapper>
      <PageHeader title="Applications" description="Review submitted applications, filter the queue, and run shortlist or reject actions." />
      <form action="/admin/applications" className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_220px_220px_auto]">
        <input name="search" defaultValue={search} placeholder="Search applications" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <select name="status" defaultValue={status} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          <option value="APPLIED">Applied</option>
          <option value="SHORTLISTED">Shortlisted</option>
          <option value="REJECTED">Rejected</option>
          <option value="WITHDRAWN">Withdrawn</option>
          <option value="IN_ROUND">In round</option>
          <option value="SELECTED">Selected</option>
          <option value="OFFERED">Offered</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="DECLINED">Declined</option>
        </select>
        <select name="roleId" defaultValue={roleId} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">All roles</option>
          {roles.items.map((role) => (
            <option key={role.$id} value={role.$id}>{role.title}</option>
          ))}
        </select>
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="studentFilter" value={studentFilter ? JSON.stringify(studentFilter) : ""} />
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Apply</button>
      </form>
      <AdminApplicationsManager
        initialData={{
          applications,
          rounds,
          variables,
        }}
        initialFilters={{
          search,
          status,
          roleId,
          companyId,
          studentFilter,
        }}
      />
    </PageWrapper>
  );
}

function parseRuleNode(value: string | undefined): RuleNode | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as RuleNode;
  } catch {
    return null;
  }
}
