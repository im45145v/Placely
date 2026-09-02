import type { Metadata } from "next";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { getStudentProfileForActor } from "@/lib/student-profile/service";
import { requireStudentAccess } from "@/lib/auth/guards";
import { ProfileForm } from "@/features/profile/ProfileForm";
import { getResumeSummaryForActor } from "@/lib/resumes/service";
import { ResumeManager } from "@/features/profile/ResumeManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "My Profile",
};

export default async function StudentProfilePage() {
  const actor = await requireStudentAccess();
  const profile = await getStudentProfileForActor(actor);
  const resumes = await getResumeSummaryForActor(actor);

  return (
    <PageWrapper>
      <PageHeader
        title="Profile"
        description="Build your placement profile to unlock opportunities."
      />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumes</CardTitle>
            <CardDescription>Upload and manage your resume</CardDescription>
          </CardHeader>
          <CardContent>
            <ResumeManager initialSummary={resumes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Personal & Academic</CardTitle>
            <CardDescription>Your identity, education, and professional information</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm initialProfile={profile} />
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
