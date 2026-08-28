/**
 * useCurrentUser — client-side hook to access the authenticated user.
 *
 * Must be used inside an <AuthProvider> (which is rendered by the protected
 * route group layouts).  Returns null when unauthenticated.
 */
"use client";

import { useAuth } from "@/features/auth/AuthContext";
import type { AppUser } from "@/types";

/**
 * Returns the current authenticated AppUser or null.
 */
export function useCurrentUser(): AppUser | null {
  return useAuth().user;
}

/**
 * Returns the current user's role or null.
 * Convenience wrapper around useCurrentUser().
 */
export function useUserRole(): AppUser["role"] | null {
  return useAuth().user?.role ?? null;
}
