import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { requireStudentAccess } from "@/lib/auth/guards";
import { getCompanyDetailForStudent } from "@/lib/companies/service";

export const metadata: Metadata = {
  title: "Company",
};

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const actor = await requireStudentAccess();
  const { companyId } = await params;
  const company = await getCompanyDetailForStudent(actor, companyId);

  return (
    <PageWrapper>
      <PageHeader title={company.name} description={company.description ?? "Company overview and published roles."} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Company details</CardTitle>
            <CardDescription>{company.industry ?? "Industry not set"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {company.logo ? <Image src={`/api/files/company-logo/${company.$id}`} alt="" width={80} height={80} className="h-20 w-20 rounded-lg border border-border object-cover" /> : null}
            <p>{company.locations.join(", ") || "No locations listed"}</p>
            {company.website ? <a href={company.website} target="_blank" rel="noreferrer" className="text-primary underline">{company.website}</a> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Published roles</CardTitle>
            <CardDescription>{company.roles.length} roles available</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {company.roles.map((role) => (
              <Link key={role.$id} href={`/roles/${role.$id}`} className="block rounded-md border border-border p-4 transition-colors hover:bg-accent/30">
                <p className="text-sm font-medium">{role.title}</p>
                <p className="text-sm text-muted-foreground">{role.location ?? "Location not set"} • {role.status}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
