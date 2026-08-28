/**
 * Server-side session retrieval and verification.
 *
 * Reads the session secret from the request cookie, creates an Appwrite
 * session-scoped client (X-Appwrite-Session header — no API key exposed),
 * and calls account.get() to verify the session is still valid.
 *
 * SERVER-SIDE ONLY — do not import from Client Components.
 */
import { cookies } from "next/headers";
import { Account, Client, type Models } from "node-appwrite";
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/appwrite/constants";
import { getSessionCookieName } from "./cookies";

/**
 * Creates a node-appwrite Client authenticated via the session secret.
 * Uses X-Appwrite-Session header — NOT the server API key.
 * This correctly scopes requests to the authenticated user's permissions.
 */
export function createSessionScopedClient(sessionSecret: string): Client {
  const client = new Client();
  client
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setSession(sessionSecret);
  return client;
}

export interface SessionData {
  authUser: Models.User<Models.Preferences>;
  sessionSecret: string;
}

/**
 * Retrieves and validates the current server-side session.
 *
 * Returns `null` when:
 * - No session cookie is present (unauthenticated)
 * - The session secret is invalid or expired
 *
 * Never throws — callers should treat null as "not authenticated".
 */
export async function getServerSession(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(getSessionCookieName())?.value;

    if (!raw) return null;

    const sessionSecret = decodeURIComponent(raw);

    const client = createSessionScopedClient(sessionSecret);
    const account = new Account(client);
    const authUser = await account.get();

    return { authUser, sessionSecret };
  } catch {
    // Invalid or expired session — treat as unauthenticated
    return null;
  }
}

/**
 * Like `getServerSession` but throws AppError.unauthorized() instead of
 * returning null.  Use in Server Actions and Route Handlers that require auth.
 */
export async function requireServerSession(): Promise<SessionData> {
  const session = await getServerSession();
  if (!session) {
    const { AppError } = await import("@/lib/errors");
    throw AppError.unauthorized("You must be signed in to perform this action.");
  }
  return session;
}
