import type { Metadata } from "next";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { CompanyCatalog } from "@/features/companies/CompanyCatalog";
import { requireStudentAccess } from "@/lib/auth/guards";
import { listCompaniesForStudents, listRolesForStudents } from "@/lib/companies/service";

export const metadata: Metadata = {
  title: "Companies",
};

export default async function StudentCompaniesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireStudentAccess();
  const params = searchParams ? await searchParams : {};
  const search = typeof params.search === "string" ? params.search : "";
  const companyPage = typeof params.companyPage === "string" ? Number(params.companyPage) : 1;
  const rolePage = typeof params.rolePage === "string" ? Number(params.rolePage) : 1;

  const [companies, roles] = await Promise.all([
    listCompaniesForStudents(actor, { search, status: "active", page: companyPage }),
    listRolesForStudents(actor, { search, status: "published", page: rolePage }),
  ]);

  return (
    <PageWrapper>
      <PageHeader title="Companies and roles" description="Browse active companies and published roles. Eligibility is intentionally not enforced in this phase." />
      <form action="/companies" className="mb-6 rounded-lg border border-border bg-card p-4">
        <input name="search" defaultValue={search} placeholder="Search companies, industries, locations, or roles" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </form>
      <CompanyCatalog companies={companies} roles={roles} />
    </PageWrapper>
  );
}
