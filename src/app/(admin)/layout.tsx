/**
 * Admin route group layout.
 *
 * - Verifies session and reads role from the database.
 * - Allows only placement_admin and super_admin roles.
 * - Students are redirected to /dashboard.
 * - Unauthenticated users are redirected to /login.
 */
import { AuthProvider } from "@/features/auth/AuthContext";
import { ImportantAnnouncementsFeed } from "@/features/announcements/ImportantAnnouncementsFeed";
import { Header } from "@/components/layout/Header";
import { AdminSidebar, ADMIN_NAV_GROUPS } from "@/components/layout/AdminSidebar";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { listImportantAnnouncements } from "@/lib/announcements/service";
import { ADMIN_NAV } from "@/lib/admin/registry";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appUser = await requireRoleAccess([
    USER_ROLES.PLACEMENT_ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ]);
  const announcements = await listImportantAnnouncements(appUser);
  const isSuperAdmin = appUser.role === USER_ROLES.SUPER_ADMIN;

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
          navItems={ADMIN_NAV}
          mobileNavGroups={ADMIN_NAV_GROUPS}
          showDesktopNav={false}
          userDisplayName={appUser.name}
          userSubtitle={isSuperAdmin ? "Super Admin" : "Admin"}
        />
        <ImportantAnnouncementsFeed initialAnnouncements={announcements} />
        <div className="flex flex-1 overflow-hidden">
          <AdminSidebar />
          <main id="main-content" className="flex-1 overflow-auto focus:outline-none" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
