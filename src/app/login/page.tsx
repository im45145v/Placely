import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * Login page — placeholder for Phase 1.
 * Authentication (Google OAuth via Appwrite) is implemented in Phase 2.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
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

        {/* Notice */}
        <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          Authentication will be set up in Phase 2 using Google OAuth via
          Appwrite Auth.
        </div>
      </div>
    </div>
  );
}
