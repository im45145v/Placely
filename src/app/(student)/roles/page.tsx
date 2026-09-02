import type { Metadata } from "next";
import Link from "next/link";
import { PageWrapper, PageHeader } from "@/components/layout/PageWrapper";
import { requireStudentAccess } from "@/lib/auth/guards";
import { listCompaniesForStudents, listRolesForStudents } from "@/lib/companies/service";
import { formatCtc, formatDate } from "@/lib/utils";
import { StudentRolesList } from "@/features/companies/StudentRolesList";
import { StatusChip } from "@/components/ui/StatusChip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "Job Profiles",
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
  const selectedRoleId = typeof params.roleId === "string" ? params.roleId : "";
  const page = typeof params.page === "string" ? Number(params.page) : 1;

  const [roles, companies] = await Promise.all([
    listRolesForStudents(actor, { search, status, companyId: companyId || undefined, page }),
    listCompaniesForStudents(actor, { search: "", status: "active", page: 1 }),
  ]);

  const selectedRole = selectedRoleId
    ? roles.items.find((r) => r.$id === selectedRoleId)
    : roles.items[0];

  return (
    <PageWrapper className="p-0">
      <div className="flex flex-col gap-4 border-b border-border px-6 py-4">
        <PageHeader
          title="Job Profiles"
          description="Browse published roles and find your next opportunity."
        />
        <form action="/roles" className="flex flex-wrap items-center gap-2">
          <input
            name="search"
            defaultValue={search}
            placeholder="Search roles..."
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            name="companyId"
            defaultValue={companyId}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All companies</option>
            {companies.items.map((company) => (
              <option key={company.$id} value={company.$id}>
                {company.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Search
          </button>
          {(search || companyId) && (
            <Link
              href="/roles"
              className="text-xs text-primary underline"
            >
              Clear filters
            </Link>
          )}
        </form>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* List panel */}
        <div className="w-[40%] overflow-y-auto border-r border-border">
          <StudentRolesList
            roles={roles.items}
            selectedRoleId={selectedRole?.$id}
            page={page}
            totalPages={roles.totalPages}
          />
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedRole ? (
            <StudentRoleDetailPanel role={selectedRole} />
          ) : (
            <EmptyState
              title="No roles selected"
              description="Select a role from the list to view details."
            />
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

function StudentRoleDetailPanel({ role }: { role: any }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{role.title}</h2>
            <p className="text-sm text-muted-foreground">
              {role.company.name} • {role.location || "Location TBD"}
            </p>
          </div>
          <StatusChip variant={role.status === "published" ? "eligible" : "closed"}>
            {role.status === "published" ? "Open" : "Closed"}
          </StatusChip>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Compensation</p>
              <p className="text-sm font-medium">{role.ctc ? formatCtc(role.ctc) : "Not set"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Application Deadline</p>
              <p className="text-sm font-medium">
                {role.applicationDeadline ? formatDate(role.applicationDeadline) : "Open"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Joining Date</p>
              <p className="text-sm font-medium">
                {role.joiningDate ? formatDate(role.joiningDate) : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Openings</p>
              <p className="text-sm font-medium">{role.numberOfOpenings || "Not set"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {role.jdText && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Job Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{role.jdText}</p>
          </CardContent>
        </Card>
      )}

      {role.requiredSkills?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Required Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {role.requiredSkills.map((skill: string) => (
                <span
                  key={skill}
                  className="rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground"
                >
                  {skill}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Link
        href={`/roles/${role.$id}`}
        className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        View Full Details
      </Link>
    </div>
  );
}
