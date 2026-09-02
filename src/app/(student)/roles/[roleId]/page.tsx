import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { requireStudentAccess } from "@/lib/auth/guards";
import { getRoleDetailForStudent } from "@/lib/companies/service";
import { formatCtc, formatDate } from "@/lib/utils";
import { StudentApplyButton } from "@/features/applications/StudentApplyButton";
import { DetailTabs } from "@/components/ui/DetailTabs";
import { StatusChip } from "@/components/ui/StatusChip";

export const metadata: Metadata = {
  title: "Role",
};

export default async function RoleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ roleId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireStudentAccess();
  const { roleId } = await params;
  const role = await getRoleDetailForStudent(actor, roleId);
  const search = searchParams ? await searchParams : {};
  const activeTab = typeof search.tab === "string" ? search.tab : "overview";

  return (
    <PageWrapper>
      <div className="mb-8">
        <Link href="/roles" className="text-xs text-primary hover:underline">
          ← Back to Job Profiles
        </Link>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{role.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {role.company.name} • {role.location || "Location TBD"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip variant={role.status === "published" ? "eligible" : "closed"}>
              {role.status === "published" ? "Open" : "Closed"}
            </StatusChip>
            <StudentApplyButton roleId={role.$id} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_320px]">
        <div className="space-y-0">
          <DetailTabs
            tabs={[
              { id: "overview", label: "Overview" },
              { id: "workflow", label: "Process" },
              { id: "eligibility", label: "Eligibility" },
              { id: "documents", label: "Documents" },
            ]}
            activeTab={activeTab}
          />

          <Card className="rounded-t-none">
            <CardContent className="pt-6">
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Description</h3>
                    <p className="mt-2 text-sm text-foreground">
                      {role.jdText || "No description provided."}
                    </p>
                  </div>

                  {role.requiredSkills?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Required Skills</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {role.requiredSkills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {role.requiredQualifications?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Qualifications
                      </h3>
                      <ul className="mt-2 space-y-1 text-sm text-foreground">
                        {role.requiredQualifications.map((qual) => (
                          <li key={qual} className="flex gap-2">
                            <span className="text-primary">•</span> {qual}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "workflow" && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                    <p>Selection process and timeline details will be provided by the company.</p>
                    <p>Check the Job Profiles page for updates on process timelines.</p>
                  </div>
                </div>
              )}

              {activeTab === "eligibility" && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 text-sm text-foreground">
                    <p>Please review the eligibility criteria with your placement office.</p>
                  </div>
                </div>
              )}

              {activeTab === "documents" && (
                <div>
                  {role.jdMetadata ? (
                    <Link
                      href={`/api/files/role-jd/${role.$id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Download Job Description
                    </Link>
                  ) : (
                    <p className="text-xs text-muted-foreground">No documents attached.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-muted-foreground">Compensation</p>
              <p className="mt-1 text-foreground">
                {role.ctc ? formatCtc(role.ctc) : "Not set"}
              </p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="font-medium text-muted-foreground">Application Deadline</p>
              <p className="mt-1 text-foreground">
                {role.applicationDeadline ? formatDate(role.applicationDeadline) : "Open"}
              </p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="font-medium text-muted-foreground">Joining Date</p>
              <p className="mt-1 text-foreground">
                {role.joiningDate ? formatDate(role.joiningDate) : "Not set"}
              </p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="font-medium text-muted-foreground">Openings</p>
              <p className="mt-1 text-foreground">{role.numberOfOpenings || "Not set"}</p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="font-medium text-muted-foreground">Work Mode</p>
              <p className="mt-1 text-foreground">{role.workMode || "Not set"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
