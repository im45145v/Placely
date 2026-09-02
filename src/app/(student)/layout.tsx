/**
 * Student route group layout with split-pane app shell.
 *
 * - Verifies the session server-side via account.get() (not just cookie presence).
 * - Reads the AppUser role from the database — never from the client.
 * - Redirects to /login if unauthenticated or if the session is invalid/expired.
 * - Redirects to /admin/dashboard if the user is an admin.
 * - Provides the authenticated user to Client Components via AuthProvider.
 * - Renders stable left sidebar + top utility bar shell for faster navigation.
 */
import { AuthProvider } from "@/features/auth/AuthContext";
import { ImportantAnnouncementsFeed } from "@/features/announcements/ImportantAnnouncementsFeed";
import { Header } from "@/components/layout/Header";
import { StudentSidebar } from "@/components/layout/StudentSidebar";
import { requireStudentAccess } from "@/lib/auth/guards";
import { listImportantAnnouncements } from "@/lib/announcements/service";

const STUDENT_SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Job Profiles", href: "/roles" },
  { label: "Applications", href: "/applications" },
  { label: "Profile", href: "/profile" },
  { label: "Notifications", href: "/notifications" },
];

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appUser = await requireStudentAccess();
  const announcements = await listImportantAnnouncements(appUser);

  return (
    <AuthProvider user={appUser}>
      <div className="flex min-h-screen flex-col">
        <Header userDisplayName={appUser.name} />
        <ImportantAnnouncementsFeed initialAnnouncements={announcements} />
        <div className="flex flex-1 overflow-hidden">
          <StudentSidebar items={STUDENT_SIDEBAR_ITEMS} />
          <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
