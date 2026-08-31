import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { requireStudentAccess } from "@/lib/auth/guards";
import { listCompaniesForStudents, listRolesForStudents } from "@/lib/companies/service";
import { formatCtc, formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Roles",
};

export default async function StudentRolesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireStudentAccess();
  const params = searchParams ? await searchParams : {};
  const search = typeof params.search === "string" ? params.search : "";
  const status = "published";
  const companyId = typeof params.companyId === "string" ? params.companyId : "";
  const page = typeof params.page === "string" ? Number(params.page) : 1;
  const [roles, companies] = await Promise.all([
    listRolesForStudents(actor, { search, status, companyId: companyId || undefined, page }),
    listCompaniesForStudents(actor, { search: "", status: "active", page: 1 }),
  ]);

  return (
    <PageWrapper>
      <PageHeader title="Roles" description="Browse published roles by company, skill match keywords, and location." />
      <form action="/roles" className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_220px_auto]">
        <input name="search" defaultValue={search} placeholder="Search roles" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <select name="companyId" defaultValue={companyId} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">All companies</option>
          {companies.items.map((company) => (
            <option key={company.$id} value={company.$id}>{company.name}</option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Apply</button>
      </form>
      <Card>
        <CardHeader>
          <CardTitle>Published roles</CardTitle>
          <CardDescription>{roles.total} matching roles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {roles.items.map((role) => (
            <Link key={role.$id} href={`/roles/${role.$id}`} className="block rounded-md border border-border p-4 transition-colors hover:bg-accent/30">
              <p className="text-sm font-medium">{role.title}</p>
              <p className="text-sm text-muted-foreground">{role.company.name} • {role.location ?? "Location not set"}</p>
              <p className="text-xs text-muted-foreground">
                {role.ctc ? `${formatCtc(role.ctc)} • ` : ""}{role.applicationDeadline ? `Deadline ${formatDate(role.applicationDeadline)}` : "Open deadline"}
              </p>
            </Link>
          ))}
          <div className="flex items-center justify-between text-sm">
            <span>Page {roles.page} of {roles.totalPages}</span>
            <div className="flex gap-2">
              {roles.page > 1 ? <Link href={`/roles?page=${roles.page - 1}`} className="rounded-md border border-border px-3 py-1.5">Previous</Link> : <span className="rounded-md border border-border px-3 py-1.5 opacity-50">Previous</span>}
              {roles.page < roles.totalPages ? <Link href={`/roles?page=${roles.page + 1}`} className="rounded-md border border-border px-3 py-1.5">Next</Link> : <span className="rounded-md border border-border px-3 py-1.5 opacity-50">Next</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
