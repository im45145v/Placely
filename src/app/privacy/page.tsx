import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Effective date: August 31, 2026
          </p>
        </div>

        <div className="space-y-4 text-sm leading-7 text-muted-foreground">
          <p>
            Placely collects the account and profile information required to
            authenticate users and support university placement workflows.
          </p>
          <p>
            OAuth sign-in may provide basic profile details such as your name
            and email address. Placely uses that information only to create and
            manage your account.
          </p>
          <p>
            Placement-related data stored in the app is used to deliver core
            product features, including profile management and access control.
          </p>
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
