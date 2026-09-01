/**
 * Session cookie constants and low-level cookie helpers.
 *
 * The session secret returned by Appwrite after OAuth callback is stored in
 * an httpOnly, Secure, SameSite=Lax cookie.  Server Components and Route
 * Handlers read it with `getSessionCookie()`; the callback route sets it with
 * `createSessionCookieValue()`.
 *
 * SERVER-SIDE ONLY — do not import from Client Components.
 */

import { APPWRITE_PROJECT_ID } from "@/lib/appwrite/constants";

/** Cookie name scoped to the project so multi-project deployments don't clash. */
export function getSessionCookieName(): string {
  return `placely_session_${APPWRITE_PROJECT_ID || "dev"}`;
}

/** Cookie max-age: 30 days in seconds. */
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export const OAUTH_STATE_COOKIE_MAX_AGE = 60 * 10;

/**
 * Returns the Set-Cookie header value string for storing the session secret.
 * httpOnly prevents JS access; Secure enforces HTTPS in production.
 */
export function buildSessionCookieHeader(secret: string): string {
  const secure =
    process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    `${getSessionCookieName()}=${encodeURIComponent(secret)}`,
    `Max-Age=${SESSION_COOKIE_MAX_AGE}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure,
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * Returns the Set-Cookie header value that clears the session cookie.
 */
export function buildClearSessionCookieHeader(): string {
  const secure =
    process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    `${getSessionCookieName()}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure,
  ]
    .filter(Boolean)
    .join("; ");
}

export function getOAuthStateCookieName(): string {
  return `placely_oauth_state_${APPWRITE_PROJECT_ID || "dev"}`;
}

export function buildOAuthStateCookieHeader(state: string): string {
  const secure =
    process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    `${getOAuthStateCookieName()}=${encodeURIComponent(state)}`,
    `Max-Age=${OAUTH_STATE_COOKIE_MAX_AGE}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure,
  ]
    .filter(Boolean)
    .join("; ");
}

export function buildClearOAuthStateCookieHeader(): string {
  const secure =
    process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    `${getOAuthStateCookieName()}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure,
  ]
    .filter(Boolean)
    .join("; ");
}
