/**
 * Authentication Server Actions.
 *
 * These are called from Client Components. They run exclusively on the server
 * so secrets are never exposed to the browser.
 *
 * Actions:
 *  - initiateGoogleLogin  — builds the Appwrite OAuth2 redirect URL
 *  - logout               — deletes the Appwrite session + clears cookie
 */
"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { Account } from "node-appwrite";
import { OAuthProvider } from "node-appwrite";
import {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
} from "@/lib/appwrite/constants";
import {
  OAUTH_STATE_COOKIE_MAX_AGE,
  buildClearSessionCookieHeader,
  getOAuthStateCookieName,
} from "@/lib/auth/cookies";
import { getServerSession } from "@/lib/auth/session";
import { createSessionScopedClient } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { getSessionCookieName } from "@/lib/auth/cookies";
import { createAuditLog } from "@/lib/audit/service";
import { getAppUser } from "@/lib/auth/userSync";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Builds and returns the Google OAuth2 redirect URL using the Appwrite token
 * flow (recommended for SSR).  The client-side component should redirect to
 * this URL (window.location.href = url).
 *
 * The success URL is `/api/auth/callback` which exchanges the one-time token
 * for an httpOnly session cookie server-side.
 */
export async function buildGoogleLoginUrl(): Promise<string> {
  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(getOAuthStateCookieName(), state, {
    maxAge: OAUTH_STATE_COOKIE_MAX_AGE,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  const successUrl = `${APP_URL}/api/auth/callback?state=${encodeURIComponent(state)}`;
  const failureUrl = `${APP_URL}/login?error=oauth_failed`;

  // Build the OAuth2 token URL manually (no window object on the server)
  const url = new URL(
    `${APPWRITE_ENDPOINT}/account/tokens/oauth2/${OAuthProvider.Google}`
  );
  url.searchParams.set("project", APPWRITE_PROJECT_ID);
  url.searchParams.set("success", successUrl);
  url.searchParams.set("failure", failureUrl);

  return url.toString();
}

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
 * Used internally by the callback route on error.
 */
export { buildClearSessionCookieHeader };
