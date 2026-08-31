"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { DocumentMetadata, Resume } from "@/types";

interface SubmittedResumeRecord {
  resume: Resume;
  metadata: DocumentMetadata | null;
  studentUserId: string;
  studentName: string;
  studentEmail: string;
}

interface AdminResumeReviewProps {
  initialRecords: SubmittedResumeRecord[];
}

export function AdminResumeReview({ initialRecords }: AdminResumeReviewProps) {
  const [records, setRecords] = useState(initialRecords);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function updateDecision(
    resumeId: string,
    decision: "verify" | "reject"
  ): void {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(
        decision === "verify"
          ? `/api/admin/resumes/${resumeId}/verify`
          : `/api/admin/resumes/${resumeId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body:
            decision === "reject"
              ? JSON.stringify({ rejectionReason: reasons[resumeId] ?? "" })
              : undefined,
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Failed to update resume.");
        return;
      }
      setRecords((current) => current.filter((item) => item.resume.$id !== resumeId));
      setMessage(decision === "verify" ? "Resume verified." : "Resume rejected.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resume verification queue</CardTitle>
        <CardDescription>
          Review submitted resumes, preview files privately, and verify or reject with a reason.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">No resumes are currently pending verification.</p>
        ) : (
          records.map((item) => (
            <div key={item.resume.$id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{item.studentName}</p>
                  <p className="text-sm text-muted-foreground">{item.studentEmail}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.resume.fileName} • v{item.resume.version} • {new Date(item.resume.uploadedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={`/api/resumes/${item.resume.$id}/preview`} target="_blank" rel="noreferrer">
                    <Button type="button" variant="outline" size="sm">Preview</Button>
                  </a>
                  <a href={`/api/resumes/${item.resume.$id}/download`}>
                    <Button type="button" variant="outline" size="sm">Download</Button>
                  </a>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => updateDecision(item.resume.$id, "verify")}
                    loading={isPending}
                  >
                    Verify
                  </Button>
                </div>
              </div>
              <label className="mt-4 flex flex-col gap-2 text-sm">
                <span className="font-medium text-foreground">Rejection reason</span>
                <textarea
                  className="min-h-24 rounded-md border border-input bg-background px-3 py-2"
                  value={reasons[item.resume.$id] ?? ""}
                  onChange={(event) =>
                    setReasons((current) => ({
                      ...current,
                      [item.resume.$id]: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => updateDecision(item.resume.$id, "reject")}
                  loading={isPending}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))
        )}

        {(message || error) && (
          <p className={error ? "text-sm text-destructive" : "text-sm text-foreground"}>
            {error ?? message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
