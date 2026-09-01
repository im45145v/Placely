import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { OAuthProvider } from "node-appwrite";
import {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
} from "@/lib/appwrite/constants";
import {
  OAUTH_STATE_COOKIE_MAX_AGE,
  getOAuthStateCookieName,
} from "@/lib/auth/cookies";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(): Promise<NextResponse> {
  const state = randomUUID();
  const successUrl = `${APP_URL}/api/auth/callback?state=${encodeURIComponent(state)}`;
  const failureUrl = `${APP_URL}/login?error=oauth_failed`;

  const url = new URL(
    `${APPWRITE_ENDPOINT}/account/tokens/oauth2/${OAuthProvider.Google}`
  );
  url.searchParams.set("project", APPWRITE_PROJECT_ID);
  url.searchParams.set("success", successUrl);
  url.searchParams.set("failure", failureUrl);

  const response = NextResponse.redirect(url);
  response.cookies.set(getOAuthStateCookieName(), state, {
    maxAge: OAUTH_STATE_COOKIE_MAX_AGE,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
