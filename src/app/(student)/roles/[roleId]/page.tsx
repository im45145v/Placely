import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { requireStudentAccess } from "@/lib/auth/guards";
import { getRoleDetailForStudent } from "@/lib/companies/service";
import { formatCtc, formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Role",
};

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const actor = await requireStudentAccess();
  const { roleId } = await params;
  const role = await getRoleDetailForStudent(actor, roleId);

  return (
    <PageWrapper>
      <PageHeader title={role.title} description={`${role.company.name} • ${role.location ?? "Location not set"}`} />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Role description</CardTitle>
            <CardDescription>{role.employmentType?.replaceAll("_", " ") ?? "Employment type not set"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>{role.jdText ?? "No description provided yet."}</p>
            {role.requiredSkills.length > 0 ? <p><strong>Skills:</strong> {role.requiredSkills.join(", ")}</p> : null}
            {role.requiredQualifications.length > 0 ? <p><strong>Qualifications:</strong> {role.requiredQualifications.join(", ")}</p> : null}
            {role.jdMetadata ? <Link href={`/api/files/role-jd/${role.$id}`} className="text-primary underline">Download JD</Link> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Role facts</CardTitle>
            <CardDescription>Published role configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><strong>Company:</strong> <Link href={`/companies/${role.company.$id}`} className="text-primary underline">{role.company.name}</Link></p>
            <p><strong>Compensation:</strong> {role.ctc ? formatCtc(role.ctc) : "Not set"}</p>
            <p><strong>Openings:</strong> {role.numberOfOpenings ?? "Not set"}</p>
            <p><strong>Deadline:</strong> {role.applicationDeadline ? formatDate(role.applicationDeadline) : "Open deadline"}</p>
            <p><strong>Joining date:</strong> {role.joiningDate ? formatDate(role.joiningDate) : "Not set"}</p>
            <p><strong>Work mode:</strong> {role.workMode ?? "Not set"}</p>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
