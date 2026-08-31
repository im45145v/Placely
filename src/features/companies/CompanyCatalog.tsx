import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import type { Company, Role } from "@/types";

interface RoleDetail extends Role {
  company: Company;
  jdMetadata: { fileName: string } | null;
}

export function CompanyCatalog({
  companies,
  roles,
}: {
  companies: { items: Company[]; page: number; totalPages: number; total: number };
  roles: { items: RoleDetail[]; page: number; totalPages: number; total: number };
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
          <CardDescription>{companies.total} matching companies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {companies.items.map((company) => (
            <Link key={company.$id} href={`/companies/${company.$id}`} className="block rounded-md border border-border p-4 transition-colors hover:bg-accent/30">
              <div className="flex items-center gap-3">
                {company.logo ? <Image src={`/api/files/company-logo/${company.$id}`} alt="" width={40} height={40} className="h-10 w-10 rounded-md border border-border object-cover" /> : null}
                <div>
                  <p className="text-sm font-medium">{company.name}</p>
                  <p className="text-sm text-muted-foreground">{company.industry ?? "No industry"} • {company.locations.join(", ") || "No locations"}</p>
                </div>
              </div>
            </Link>
          ))}
          <Pagination basePath="/companies" page={companies.page} totalPages={companies.totalPages} pageParam="companyPage" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Open roles</CardTitle>
          <CardDescription>{roles.total} published roles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {roles.items.map((role) => (
            <Link key={role.$id} href={`/roles/${role.$id}`} className="block rounded-md border border-border p-4 transition-colors hover:bg-accent/30">
              <p className="text-sm font-medium">{role.title}</p>
              <p className="text-sm text-muted-foreground">{role.company.name} • {role.location ?? "Location not set"}</p>
              <p className="text-xs text-muted-foreground">
                {role.applicationDeadline ? `Apply by ${formatDate(role.applicationDeadline)}` : "Open deadline"}
              </p>
            </Link>
          ))}
          <Pagination basePath="/companies" page={roles.page} totalPages={roles.totalPages} pageParam="rolePage" />
        </CardContent>
      </Card>
    </div>
  );
}

function Pagination({ basePath, page, totalPages, pageParam }: { basePath: string; page: number; totalPages: number; pageParam: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>Page {page} of {totalPages}</span>
      <div className="flex gap-2">
        {page > 1 ? <Link href={`${basePath}?${pageParam}=${page - 1}`} className="rounded-md border border-border px-3 py-1.5">Previous</Link> : <span className="rounded-md border border-border px-3 py-1.5 opacity-50">Previous</span>}
        {page < totalPages ? <Link href={`${basePath}?${pageParam}=${page + 1}`} className="rounded-md border border-border px-3 py-1.5">Next</Link> : <span className="rounded-md border border-border px-3 py-1.5 opacity-50">Next</span>}
      </div>
    </div>
  );
}
