/**
 * AuthContext — client-side authentication state.
 *
 * Provides the current AppUser (or null) to any Client Component via context.
 * The user data is passed from the Server Component layout as a prop.
 *
 * Does NOT perform any Appwrite API calls — that is done server-side only.
 */
"use client";

import React, { createContext, useContext } from "react";
import type { AppUser } from "@/types";

interface AuthContextValue {
  user: AppUser | null;
}

const AuthContext = createContext<AuthContextValue>({ user: null });

interface AuthProviderProps {
  user: AppUser | null;
  children: React.ReactNode;
}

export function AuthProvider({
  user,
  children,
}: AuthProviderProps): React.ReactElement {
  return (
    <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
  );
}

/**
 * Returns the current authenticated user from context.
 * Returns null when unauthenticated.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
