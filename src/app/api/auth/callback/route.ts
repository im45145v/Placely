/**
 * OAuth callback Route Handler.
 *
 * After Google OAuth succeeds, Appwrite redirects here with:
 *   ?userId=<userId>&secret=<oauthSecret>
 *
 * This handler:
 *  1. Exchanges the token pair for an Appwrite session (server-side API key call).
 *  2. Retrieves the session.secret (session token) from the response.
 *  3. Stores the session token in an httpOnly cookie.
 *  4. Syncs / creates the AppUser document in the database.
 *  5. Redirects to the appropriate dashboard based on user role.
 *
 * SECURITY:
 *  - Uses server API key for session creation — never exposed to client.
 *  - userId and secret parameters are one-time tokens; they expire after use.
 *  - Session secret stored in httpOnly cookie — inaccessible to JavaScript.
 */
import { NextRequest, NextResponse } from "next/server";
import { Account } from "node-appwrite";
import { createServerClient } from "@/lib/appwrite/server";
import {
  buildSessionCookieHeader,
  buildClearSessionCookieHeader,
} from "@/lib/auth/cookies";
import { getRoleDestination } from "@/lib/auth/roles";
import { syncUserRecord } from "@/lib/auth/userSync";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const secret = searchParams.get("secret");

  // Validate required parameters
  if (!userId || !secret) {
    console.error("[auth/callback] Missing userId or secret params");
    return NextResponse.redirect(
      new URL("/login?error=oauth_failed", APP_URL)
    );
  }

  try {
    // 1. Exchange one-time token for a session (requires server API key)
    const serverClient = createServerClient();
    const account = new Account(serverClient);
    const session = await account.createSession({ userId, secret });

    // session.secret is only returned when created with an API key
    const sessionSecret = session.secret;
    if (!sessionSecret) {
      throw new Error("Appwrite did not return a session secret");
    }

    // 2. Get the verified user's info using a session-scoped client
    const { createSessionScopedClient } = await import("@/lib/auth/session");
    const sessionAccount = new Account(createSessionScopedClient(sessionSecret));
    const authUser = await sessionAccount.get();

    // 3. Sync / create the AppUser document
    const appUser = await syncUserRecord(authUser);

    // 3. Determine redirect destination based on role
    const destination = getRoleDestination(appUser.role);

    // 4. Build response with httpOnly session cookie
    const response = NextResponse.redirect(new URL(destination, APP_URL));
    response.headers.set("Set-Cookie", buildSessionCookieHeader(sessionSecret));

    return response;
  } catch (err) {
    console.error("[auth/callback] Error creating session:", err);

    // Clear any partial cookie and redirect to login with error
    const response = NextResponse.redirect(
      new URL("/login?error=auth_failed", APP_URL)
    );
    response.headers.set("Set-Cookie", buildClearSessionCookieHeader());
    return response;
  }
}
