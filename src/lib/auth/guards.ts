import { redirect } from "next/navigation";
import type { AppUser, UserRole } from "@/types";
import { getServerSession } from "@/lib/auth/session";
import { syncUserRecord } from "@/lib/auth/userSync";
import { getRoleDestination, isAdminRole } from "./roles";

export async function requireAuthenticatedAppUser(): Promise<AppUser> {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const user = await syncUserRecord(session.authUser);
  if (!user.isActive) {
    redirect("/login?error=inactive_user");
  }

  return user;
}

export async function requireRoleAccess(allowedRoles: readonly UserRole[]): Promise<AppUser> {
  const user = await requireAuthenticatedAppUser();
  if (!allowedRoles.includes(user.role)) {
    redirect(getRoleDestination(user.role));
  }
  return user;
}

export async function requireStudentAccess(): Promise<AppUser> {
  const user = await requireAuthenticatedAppUser();
  if (isAdminRole(user.role)) {
    redirect("/admin/dashboard");
  }
  return user;
}
