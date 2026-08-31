import type { Metadata } from "next";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { AdminCompaniesManager } from "@/features/companies/AdminCompaniesManager";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { listCompaniesForAdmin } from "@/lib/companies/service";

export const metadata: Metadata = {
  title: "Admin Companies",
};

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireRoleAccess(ADMIN_ROLES);
  const params = searchParams ? await searchParams : {};
  const search = typeof params.search === "string" ? params.search : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const page = typeof params.page === "string" ? Number(params.page) : 1;
  const companies = await listCompaniesForAdmin(actor, { search, status: status as "active" | "archived" | "all", page });

  return (
    <PageWrapper>
      <PageHeader title="Companies" description="Create, edit, archive, and manage company logos." />
      <SearchBar action="/admin/companies" search={search} status={status} />
      <AdminCompaniesManager initialCompanies={companies} search={search} status={status} />
    </PageWrapper>
  );
}

function SearchBar({ action, search, status }: { action: string; search: string; status: string }) {
  return (
    <form action={action} className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_180px_auto]">
      <input name="search" defaultValue={search} placeholder="Search companies" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
      <select name="status" defaultValue={status} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </select>
      <ButtonSlot />
    </form>
  );
}

function ButtonSlot() {
  return <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Apply</button>;
}
