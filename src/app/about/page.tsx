import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          About Placely
        </h1>
        <p className="text-muted-foreground">
          Placely is a university placement management platform that manages
          the complete placement lifecycle — from student profiles through to
          final placement offers.
        </p>
        <Link
          href="/"
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
