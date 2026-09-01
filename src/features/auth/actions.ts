/**
 * Authentication Server Actions.
 *
 * These are called from Client Components. They run exclusively on the server
 * so secrets are never exposed to the browser.
 *
 * Actions:
 *  - logout — deletes the Appwrite session + clears cookie
 */
"use server";

import { redirect } from "next/navigation";
import { Account } from "node-appwrite";
import {
  buildClearSessionCookieHeader,
} from "@/lib/auth/cookies";
import { getServerSession } from "@/lib/auth/session";
import { createSessionScopedClient } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { getSessionCookieName } from "@/lib/auth/cookies";
import { createAuditLog } from "@/lib/audit/service";
import { getAppUser } from "@/lib/auth/userSync";

/**
 * Logs the user out:
 *  1. Deletes the current session from Appwrite (server-side).
 *  2. Clears the session cookie.
 *  3. Redirects to /login.
 */
export async function logout(): Promise<void> {
  const session = await getServerSession();

  if (session) {
    try {
      const appUser = await getAppUser(session.authUser.$id);
      if (appUser) {
        await createAuditLog(appUser, {
          action: "auth.logout",
          entityType: "session",
          entityId: session.authUser.$id,
          newValue: { email: session.authUser.email },
        });
      }
      const client = createSessionScopedClient(session.sessionSecret);
      const account = new Account(client);
      // "current" deletes the session identified by the session token
      await account.deleteSession("current");
    } catch (err) {
      // Log but don't block logout — cookie will be cleared regardless
      console.warn("[logout] Error deleting Appwrite session:", err);
    }
  }

  // Clear the session cookie
  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), "", {
    maxAge: 0,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/login");
}

/**
 * Returns the redirect header value for clearing the session.
 * Used by the auth callback route on error.
 */
export { buildClearSessionCookieHeader };
