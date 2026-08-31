/**
 * Student route group layout.
 *
 * - Verifies the session server-side via account.get() (not just cookie presence).
 * - Reads the AppUser role from the database — never from the client.
 * - Redirects to /login if unauthenticated or if the session is invalid/expired.
 * - Redirects to /admin/dashboard if the user is an admin.
 * - Provides the authenticated user to Client Components via AuthProvider.
 */
import { AuthProvider } from "@/features/auth/AuthContext";
import { ImportantAnnouncementsFeed } from "@/features/announcements/ImportantAnnouncementsFeed";
import { Header } from "@/components/layout/Header";
import { requireStudentAccess } from "@/lib/auth/guards";
import { listImportantAnnouncements } from "@/lib/announcements/service";

const STUDENT_NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Profile", href: "/profile" },
  { label: "Companies", href: "/companies" },
  { label: "Applications", href: "/applications" },
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
        <Header
          navItems={STUDENT_NAV}
          userDisplayName={appUser.name}
        />
        <ImportantAnnouncementsFeed initialAnnouncements={announcements} />
        <main className="flex-1">{children}</main>
      </div>
    </AuthProvider>
  );
}
