import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Placely — Campus placements, simplified.",
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <span className="text-xl font-bold tracking-tight text-foreground">
            Place<span className="text-primary">ly</span>
          </span>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Campus placements,{" "}
            <span className="text-primary">simplified.</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Placely manages the complete university placement lifecycle — from
            student profiles and company listings to eligibility checks,
            interviews, and final offers.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg">Get started</Button>
            </Link>
            <Link href="/about">
              <Button size="lg" variant="outline">
                Learn more
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Placely. All rights reserved.
      </footer>
    </div>
  );
}
