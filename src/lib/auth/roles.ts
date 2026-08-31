import type { UserRole } from "@/types";

export const USER_ROLES = {
  STUDENT: "STUDENT",
  PLACEMENT_ADMIN: "PLACEMENT_ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const satisfies Record<string, UserRole>;

export const ADMIN_ROLES: readonly UserRole[] = [
  USER_ROLES.PLACEMENT_ADMIN,
  USER_ROLES.SUPER_ADMIN,
];

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function getRoleDestination(role: UserRole): string {
  return isAdminRole(role) ? "/admin/dashboard" : "/dashboard";
}
