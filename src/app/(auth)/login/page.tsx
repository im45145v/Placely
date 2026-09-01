/**
 * Login page — "Continue with Google" button.
 *
 * The button redirects to `/api/auth/login`, which creates the OAuth state
 * cookie and forwards the browser to Appwrite's Google OAuth flow. The OAuth
 * flow completes at `/api/auth/callback`.
 */
import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>> | Record<string, string>;
}) {
  // searchParams may be a Promise in Next.js 15+
  const params =
    searchParams instanceof Promise ? null : searchParams;
  const error = params?.error;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Place<span className="text-primary">ly</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Campus placements, simplified.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage(error)}
          </div>
        )}

        {/* Sign-in form */}
        <LoginForm />

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          By signing in you agree to our{" "}
          <span className="underline">Terms of Service</span> and{" "}
          <span className="underline">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}

function errorMessage(code: string): string {
  switch (code) {
    case "oauth_failed":
      return "Google sign-in was cancelled or failed. Please try again.";
    case "auth_failed":
      return "Authentication failed. Please try again.";
    default:
      return "An unexpected error occurred. Please try again.";
  }
}
