"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const ENTITIES = [
  { value: "students", label: "Students" },
  { value: "companies", label: "Companies" },
  { value: "roles", label: "Roles" },
  { value: "shortlists", label: "Shortlists" },
  { value: "results", label: "Results" },
  { value: "interview_schedules", label: "Interview Schedules" },
] as const;

const FORMATS = [
  { value: "csv", label: "CSV" },
  { value: "tsv", label: "Excel TSV" },
] as const;

interface ImportRowResult {
  rowNumber: number;
  identifier: string;
  status: "ready" | "failed" | "success";
  reason?: string;
  values: Record<string, string>;
}

interface PreviewResponse {
  previewId: string;
  entity: string;
  fileName: string;
  format: string;
  totalRows: number;
  readyRows: number;
  errorCount: number;
  rows: ImportRowResult[];
}

interface ExecutionResponse {
  previewId: string;
  entity: string;
  processedAt: string;
  totalRows: number;
  successfulRows: ImportRowResult[];
  failedRows: ImportRowResult[];
  errorReportId?: string;
}

export function AdminImportExportWorkbench() {
  const [entity, setEntity] = useState<(typeof ENTITIES)[number]["value"]>("students");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [summary, setSummary] = useState<ExecutionResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const exportLinks = useMemo(
    () => FORMATS.map((format) => ({
      ...format,
      href: `/api/admin/import-export/export?entity=${entity}&format=${format.value}`,
    })),
    [entity]
  );

  function createPreview() {
    if (!file) {
      setError("Select a CSV or TSV file first.");
      return;
    }
    setError(null);
    setMessage(null);
    setSummary(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("entity", entity);
      formData.set("file", file);
      const response = await fetch("/api/admin/import-export/preview", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Failed to build import preview.");
        return;
      }
      setPreview(data);
      setMessage("Preview generated. Resolve any errors by editing the file and re-uploading.");
    });
  }

  function confirmImport() {
    if (!preview) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/import-export/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewId: preview.previewId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Import failed.");
        return;
      }
      setSummary(data);
      setMessage("Import processed.");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import</CardTitle>
          <CardDescription>Upload a CSV or Excel-friendly TSV/TXT file. The server validates every row first, shows a preview, and only processes after explicit confirmation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[220px_1fr_auto]">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Entity</span>
            <select value={entity} onChange={(event) => setEntity(event.target.value as typeof entity)} className="rounded-md border border-input bg-background px-3 py-2">
              {ENTITIES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">File</span>
            <input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="rounded-md border border-input bg-background px-3 py-2" />
          </label>
          <div className="flex items-end">
            <Button type="button" onClick={createPreview} loading={isPending}>Validate & Preview</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>Download current university data in CSV or Excel-friendly TSV format.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {exportLinks.map((link) => (
            <a key={link.value} href={link.href} className="rounded-md border border-input px-4 py-2 text-sm font-medium">
              Export {ENTITIES.find((item) => item.value === entity)?.label} as {link.label}
            </a>
          ))}
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>{preview.readyRows} of {preview.totalRows} rows are ready. {preview.errorCount} rows currently fail validation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Row</th>
                    <th className="px-3 py-2 text-left font-medium">Identifier</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={`${row.rowNumber}-${row.identifier}`} className="border-t border-border">
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.identifier}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.reason ?? "Ready"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={confirmImport} loading={isPending} disabled={preview.errorCount > 0}>Confirm & Process</Button>
              <Button type="button" variant="outline" onClick={() => { setPreview(null); setSummary(null); setFile(null); }}>Re-upload</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>{summary.successfulRows.length} successful rows, {summary.failedRows.length} failed rows, processed at {new Date(summary.processedAt).toLocaleString()}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <SummaryBlock title="Successful Rows" rows={summary.successfulRows} />
              <SummaryBlock title="Failed Rows" rows={summary.failedRows} />
            </div>
            {summary.errorReportId ? (
              <a href={`/api/admin/import-export/reports/${summary.errorReportId}`} className="inline-flex rounded-md border border-input px-4 py-2 text-sm font-medium">
                Download Error Report
              </a>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {(message || error) ? (
        <p className={error ? "text-sm text-destructive" : "text-sm text-foreground"}>{error ?? message}</p>
      ) : null}
    </div>
  );
}

function SummaryBlock({ title, rows }: { title: string; rows: ImportRowResult[] }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{rows.length} rows</p>
      <div className="mt-3 max-h-72 overflow-y-auto space-y-2">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : rows.map((row) => (
          <div key={`${title}-${row.rowNumber}-${row.identifier}`} className="rounded-md bg-muted/30 px-3 py-2 text-sm">
            <p className="font-medium">Row {row.rowNumber}: {row.identifier}</p>
            <p className="text-muted-foreground">{row.reason ?? "Processed successfully."}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
