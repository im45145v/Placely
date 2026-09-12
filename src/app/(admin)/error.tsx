"use client";

import { Button } from "@/components/ui/Button";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageWrapper>
      <EmptyState
        title="Something went wrong"
        description="We couldn't load this admin page. Please try again — if the problem persists, contact platform support."
        action={
          <Button type="button" onClick={reset}>
            Try again
          </Button>
        }
      />
      {error.digest ? <p className="mt-4 text-center text-xs text-muted-foreground">Error reference: {error.digest}</p> : null}
    </PageWrapper>
  );
}