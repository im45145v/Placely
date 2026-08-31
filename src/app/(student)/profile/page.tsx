import type { Metadata } from "next";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { getStudentProfileForActor } from "@/lib/student-profile/service";
import { requireStudentAccess } from "@/lib/auth/guards";
import { ProfileForm } from "@/features/profile/ProfileForm";
import { getResumeSummaryForActor } from "@/lib/resumes/service";
import { ResumeManager } from "@/features/profile/ResumeManager";

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
        title="My profile"
        description="Manage your identity, academic, professional, custom variable, and permitted placement settings."
      />
      <ResumeManager initialSummary={resumes} />
      <ProfileForm initialProfile={profile} />
    </PageWrapper>
  );
}
