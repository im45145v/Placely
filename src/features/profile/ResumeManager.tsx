"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { DocumentMetadata, Resume } from "@/types";

interface ResumeWithMetadata {
  resume: Resume;
  metadata: DocumentMetadata | null;
}

interface ResumeSummary {
  currentResume: ResumeWithMetadata | null;
  history: ResumeWithMetadata[];
}

interface ResumeManagerProps {
  initialSummary: ResumeSummary;
}

export function ResumeManager({ initialSummary }: ResumeManagerProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function runAction(action: () => Promise<void>): void {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
      } catch (actionError) {
        setError(
          actionError instanceof Error ? actionError.message : "An unexpected error occurred."
        );
      }
    });
  }

  function uploadSelectedFile(): void {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a resume file first.");
      return;
    }

    runAction(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/resumes", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to upload resume.");
      }
      setSummary(data);
      setMessage("Resume uploaded as a new version.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    });
  }

  function submitForVerification(resumeId: string): void {
    runAction(async () => {
      const response = await fetch(`/api/resumes/${resumeId}/submit`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to submit resume.");
      }
      setSummary((current) => ({
        ...current,
        currentResume:
          current.currentResume?.resume.$id === resumeId
            ? { ...current.currentResume, resume: data }
            : current.currentResume,
        history: current.history.map((item) =>
          item.resume.$id === resumeId ? { ...item, resume: data } : item
        ),
      }));
      setMessage("Resume submitted for verification.");
    });
  }

  function deleteResume(resumeId: string): void {
    runAction(async () => {
      const response = await fetch(`/api/resumes/${resumeId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to delete resume.");
      }
      setSummary(data);
      setMessage("Resume deleted.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resume management</CardTitle>
        <CardDescription>
          Upload resumes to private Appwrite Storage, track versions, and submit the current version for verification.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-foreground">Upload or replace resume</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="rounded-md border border-input bg-background px-3 py-2"
            />
            <span className="text-xs text-muted-foreground">
              Allowed types: PDF, DOC, DOCX. Maximum size: 5 MB.
            </span>
          </label>
          <div className="flex items-end">
            <Button type="button" onClick={uploadSelectedFile} loading={isPending}>
              Upload
            </Button>
          </div>
        </div>

        {summary.currentResume ? (
          <div className="rounded-md border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{summary.currentResume.resume.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  Current version v{summary.currentResume.resume.version} • {formatStatus(summary.currentResume.resume.status)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Uploaded {formatDate(summary.currentResume.resume.uploadedAt)} • {formatFileSize(summary.currentResume.resume.fileSize)}
                </p>
                {summary.currentResume.resume.rejectionReason && (
                  <p className="mt-2 text-sm text-destructive">
                    Rejection reason: {summary.currentResume.resume.rejectionReason}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`/api/resumes/${summary.currentResume.resume.$id}/preview`} target="_blank" rel="noreferrer">
                  <Button type="button" variant="outline">Preview</Button>
                </a>
                <a href={`/api/resumes/${summary.currentResume.resume.$id}/download`}>
                  <Button type="button" variant="outline">Download</Button>
                </a>
                {summary.currentResume.resume.status !== "PENDING" &&
                summary.currentResume.resume.status !== "VERIFIED" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => submitForVerification(summary.currentResume!.resume.$id)}
                    loading={isPending}
                  >
                    Submit for verification
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No resume uploaded yet.
          </p>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Version history</h3>
          {summary.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resume versions found.</p>
          ) : (
            <div className="space-y-3">
              {summary.history.map((item) => (
                <div key={item.resume.$id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        v{item.resume.version} {item.resume.isCurrent ? "• Current" : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.resume.fileName} • {formatStatus(item.resume.status)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.resume.uploadedAt)} • {formatFileSize(item.resume.fileSize)}
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
                        variant="danger"
                        size="sm"
                        onClick={() => deleteResume(item.resume.$id)}
                        loading={isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  {item.resume.rejectionReason ? (
                    <p className="mt-2 text-sm text-destructive">
                      Rejection reason: {item.resume.rejectionReason}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {(message || error) && (
          <p className={error ? "text-sm text-destructive" : "text-sm text-foreground"}>
            {error ?? message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function formatStatus(status: Resume["status"]): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function formatFileSize(value: number): string {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.ceil(value / 1024)} KB`;
}
