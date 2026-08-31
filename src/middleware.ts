/**
 * Next.js Edge Middleware — route protection.
 *
 * Runs on every request before it reaches a route handler or page.
 * Performs a lightweight session cookie presence check only (no Appwrite call —
 * the Edge Runtime cannot use node-appwrite).
 *
 * Full session verification (account.get()) is done in the layout Server
 * Components, which can use node-appwrite.
 *
 * Redirect rules:
 *  - Unauthenticated user → protected route  : redirect to /login
 *  - Authenticated user   → /login or /       : redirect to /dashboard
 */
import { NextRequest, NextResponse } from "next/server";

/** Routes accessible only to authenticated users. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/profile",
  "/companies",
  "/roles",
  "/applications",
  "/rounds",
  "/notifications",
];

/** Routes that authenticated users should be redirected away from. */
const AUTH_ONLY_PATHS = ["/login"];

/** Routes that bypass all middleware checks (public assets, API, etc.). */
const PUBLIC_PREFIXES = [
  "/api/auth",   // OAuth callback must be reachable unauthenticated
  "/_next",
  "/favicon",
  "/public",
];

function getSessionCookieName(projectId: string): string {
  return `placely_session_${projectId || "dev"}`;
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Skip middleware for public paths
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
  const cookieName = getSessionCookieName(projectId);
  const sessionCookie = request.cookies.get(cookieName)?.value;
  const isAuthenticated = Boolean(sessionCookie);

  // Unauthenticated → protected route: redirect to login
  if (!isAuthenticated && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated → login page: redirect to dashboard
  if (isAuthenticated && AUTH_ONLY_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images.
     * This keeps the matcher lean to avoid unnecessary Edge invocations.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
