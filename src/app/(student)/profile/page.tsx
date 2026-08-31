import type { Metadata } from "next";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { getStudentProfileForActor } from "@/lib/student-profile/service";
import { requireStudentAccess } from "@/lib/auth/guards";
import { ProfileForm } from "@/features/profile/ProfileForm";

export const metadata: Metadata = {
  title: "My Profile",
};

export default async function StudentProfilePage() {
  const actor = await requireStudentAccess();
  const profile = await getStudentProfileForActor(actor);

  return (
    <PageWrapper>
      <PageHeader
        title="My profile"
        description="Manage your identity, academic, professional, and permitted placement settings."
      />
      <ProfileForm initialProfile={profile} />
    </PageWrapper>
  );
}
