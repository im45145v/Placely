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
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <Header
          navItems={STUDENT_SIDEBAR_ITEMS}
          showDesktopNav={false}
          userDisplayName={appUser.name}
          profileHref="/profile"
        />
        <ImportantAnnouncementsFeed initialAnnouncements={announcements} />
        <div className="flex flex-1 overflow-hidden">
          <StudentSidebar items={STUDENT_SIDEBAR_ITEMS} />
          <main id="main-content" className="flex-1 overflow-auto focus:outline-none" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
