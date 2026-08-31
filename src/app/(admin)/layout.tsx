/**
 * Admin route group layout.
 *
 * - Verifies session and reads role from the database.
 * - Allows only placement_admin and super_admin roles.
 * - Students are redirected to /dashboard.
 * - Unauthenticated users are redirected to /login.
 */
import { AuthProvider } from "@/features/auth/AuthContext";
import { Header } from "@/components/layout/Header";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";

const ADMIN_NAV = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Students", href: "/admin/students" },
  { label: "Companies", href: "/admin/companies" },
  { label: "Roles", href: "/admin/roles" },
  { label: "Applications", href: "/admin/applications" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appUser = await requireRoleAccess([
    USER_ROLES.PLACEMENT_ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ]);

  return (
    <AuthProvider user={appUser}>
      <div className="flex min-h-screen flex-col">
        <Header
          navItems={ADMIN_NAV}
          userDisplayName={`${appUser.name} (${appUser.role === USER_ROLES.SUPER_ADMIN ? "Super Admin" : "Admin"})`}
        />
        <main className="flex-1">{children}</main>
      </div>
    </AuthProvider>
  );
}
