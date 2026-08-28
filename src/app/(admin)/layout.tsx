/**
 * Admin route group layout.
 *
 * - Verifies session and reads role from the database.
 * - Allows only placement_admin and super_admin roles.
 * - Students are redirected to /dashboard.
 * - Unauthenticated users are redirected to /login.
 */
import { redirect } from "next/navigation";
import { AuthProvider } from "@/features/auth/AuthContext";
import { getServerSession } from "@/lib/auth/session";
import { getAppUser } from "@/lib/auth/userSync";
import { Header } from "@/components/layout/Header";

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
  // 1. Verify session
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  // 2. Read role from database — never trust a role from the client
  const appUser = await getAppUser(session.authUser.$id);
  if (!appUser) {
    redirect("/login");
  }

  // 3. Only admins allowed in this route group
  if (appUser.role !== "placement_admin" && appUser.role !== "super_admin") {
    redirect("/dashboard");
  }

  return (
    <AuthProvider user={appUser}>
      <div className="flex min-h-screen flex-col">
        <Header
          navItems={ADMIN_NAV}
          userDisplayName={`${appUser.name} (${appUser.role === "super_admin" ? "Super Admin" : "Admin"})`}
        />
        <main className="flex-1">{children}</main>
      </div>
    </AuthProvider>
  );
}
