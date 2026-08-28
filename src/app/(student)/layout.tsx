/**
 * Student route group layout.
 *
 * - Verifies the session server-side via account.get() (not just cookie presence).
 * - Reads the AppUser role from the database — never from the client.
 * - Redirects to /login if unauthenticated or if the session is invalid/expired.
 * - Redirects to /admin/dashboard if the user is an admin.
 * - Provides the authenticated user to Client Components via AuthProvider.
 */
import { redirect } from "next/navigation";
import { AuthProvider } from "@/features/auth/AuthContext";
import { getServerSession } from "@/lib/auth/session";
import { getAppUser } from "@/lib/auth/userSync";
import { Header } from "@/components/layout/Header";

const STUDENT_NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Companies", href: "/companies" },
  { label: "Applications", href: "/applications" },
  { label: "Notifications", href: "/notifications" },
];

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Verify session (calls account.get() — detects invalid/expired sessions)
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  // 2. Read role from database (never from client)
  const appUser = await getAppUser(session.authUser.$id);
  if (!appUser) {
    // First-login race or DB not provisioned — redirect to login
    redirect("/login");
  }

  // 3. Admin users should not be in the student route group
  if (appUser.role === "placement_admin" || appUser.role === "super_admin") {
    redirect("/admin/dashboard");
  }

  return (
    <AuthProvider user={appUser}>
      <div className="flex min-h-screen flex-col">
        <Header
          navItems={STUDENT_NAV}
          userDisplayName={appUser.name}
        />
        <main className="flex-1">{children}</main>
      </div>
    </AuthProvider>
  );
}
