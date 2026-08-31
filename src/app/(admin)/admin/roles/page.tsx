import type { Metadata } from "next";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { AdminRolesManager } from "@/features/companies/AdminRolesManager";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { listCompaniesForAdmin, listRolesForAdmin } from "@/lib/companies/service";
import { listEligibilityVariablesForUniversity } from "@/lib/eligibility/service";

export const metadata: Metadata = {
  title: "Admin Roles",
};

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export default async function AdminRolesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireRoleAccess(ADMIN_ROLES);
  const params = searchParams ? await searchParams : {};
  const search = typeof params.search === "string" ? params.search : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const companyId = typeof params.companyId === "string" ? params.companyId : "";
  const page = typeof params.page === "string" ? Number(params.page) : 1;
  const [roles, companies, variables] = await Promise.all([
    listRolesForAdmin(actor, { search, status: status as "draft" | "published" | "closed" | "cancelled" | "all", companyId: companyId || undefined, page }),
    listCompaniesForAdmin(actor, { search: "", status: "active", page: 1 }),
    listEligibilityVariablesForUniversity(actor),
  ]);

  return (
    <PageWrapper>
      <PageHeader title="Roles" description="Create and manage roles for each company, including publishing, closing, duplication, compensation, openings, deadlines, and JD attachments." />
      <form action="/admin/roles" className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_180px_200px_auto]">
        <input name="search" defaultValue={search} placeholder="Search roles" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <select name="status" defaultValue={status} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Archived</option>
        </select>
        <select name="companyId" defaultValue={companyId} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">All companies</option>
          {companies.items.map((company) => (
            <option key={company.$id} value={company.$id}>{company.name}</option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Apply</button>
      </form>
      <AdminRolesManager initialRoles={roles} companies={companies.items} variables={variables} />
    </PageWrapper>
  );
}
