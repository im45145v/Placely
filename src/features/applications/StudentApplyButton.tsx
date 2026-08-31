"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

export function StudentApplyButton({ roleId }: { roleId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function apply(): void {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Failed to apply.");
        return;
      }
      setMessage("Application submitted.");
    });
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={apply} loading={isPending}>Apply now</Button>
      {(message || error) ? <p className={error ? "text-sm text-destructive" : "text-sm"}>{error ?? message}</p> : null}
    </div>
  );
}
