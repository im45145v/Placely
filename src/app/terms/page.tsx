import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">
            Effective date: August 31, 2026
          </p>
        </div>

        <div className="space-y-4 text-sm leading-7 text-muted-foreground">
          <p>
            Placely is provided for managing university placement activity and
            related student workflows.
          </p>
          <p>
            By using Placely, you agree to use the service only for legitimate
            educational and placement-management purposes.
          </p>
          <p>
            Access may be limited, suspended, or updated as the product and its
            institutional policies evolve.
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
    </div>
  );
}
