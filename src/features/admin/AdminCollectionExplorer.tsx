"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/feedback/EmptyState";
import type { AdminCollectionPageData } from "@/lib/admin/service";

export function AdminCollectionExplorer({ data }: { data: AdminCollectionPageData }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentPageIds = useMemo(() => data.records.map((record) => record.id), [data.records]);
  const allPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.includes(id));

  function toggle(id: string): void {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function togglePage(): void {
    setSelectedIds((current) => allPageSelected ? current.filter((id) => !currentPageIds.includes(id)) : [...new Set([...current, ...currentPageIds])]);
  }

  function runBulkAction(action: "copy" | "export" | "clear"): void {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        if (action === "clear") {
          if (!window.confirm("Clear the current selection?")) return;
          setSelectedIds([]);
          setMessage("Selection cleared.");
          return;
        }

        const selectedRecords = data.records.filter((record) => selectedIds.includes(record.id));
        if (selectedRecords.length === 0) {
          throw new Error("Select at least one record first.");
        }

        if (action === "copy") {
          await navigator.clipboard.writeText(selectedRecords.map((record) => record.id).join("\n"));
          setMessage(`Copied ${selectedRecords.length} record IDs.`);
          return;
        }

        if (!window.confirm(`Export ${selectedRecords.length} selected records as JSON?`)) return;
        const blob = new Blob([JSON.stringify(selectedRecords, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${data.section.slug}-selection.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        setMessage(`Exported ${selectedRecords.length} records.`);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Bulk action failed.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{data.section.label}</CardTitle>
        <CardDescription>
          {data.total} records matched. Search, filters, sorting, pagination, selection, and bulk export are handled on this screen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={togglePage}>
              {allPageSelected ? "Unselect Page" : "Select Page"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => runBulkAction("copy")} loading={isPending}>
              Copy IDs
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => runBulkAction("export")} loading={isPending}>
              Export JSON
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => runBulkAction("clear")} loading={isPending}>
              Clear Selection
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{selectedIds.length} selected on this page.</p>
        </div>

        {data.records.length === 0 ? (
          <EmptyState
            title={`No ${data.section.label.toLowerCase()} found`}
            description="Adjust the current search, filters, or page range to widen the result set."
            action={<Link href={`/admin/${data.section.slug}`} className="rounded-md border border-input px-4 py-2 text-sm font-medium">Reset view</Link>}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Select</th>
                  {data.columns.map((column) => (
                    <th key={column} className="px-3 py-2 text-left font-medium">{labelize(column)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.records.map((record) => (
                  <tr key={record.id} className="border-t border-border align-top">
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => toggle(record.id)} aria-label={`Select ${record.id}`} />
                    </td>
                    {data.columns.map((column) => (
                      <td key={column} className="max-w-[240px] px-3 py-3 text-muted-foreground">
                        <div className="truncate" title={formatValue(readValue(record.values, column))}>
                          {formatValue(readValue(record.values, column))}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Link
              href={buildPageHref(data, Math.max(1, data.page - 1))}
              aria-disabled={data.page === 1}
              className="rounded-md border border-input px-3 py-2 text-sm font-medium disabled:pointer-events-none"
            >
              Previous
            </Link>
            <Link
              href={buildPageHref(data, Math.min(data.totalPages, data.page + 1))}
              aria-disabled={data.page === data.totalPages}
              className="rounded-md border border-input px-3 py-2 text-sm font-medium disabled:pointer-events-none"
            >
              Next
            </Link>
          </div>
        </div>

        {(message || error) ? (
          <p className={error ? "text-sm text-destructive" : "text-sm text-foreground"}>
            {error ?? message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function buildPageHref(data: AdminCollectionPageData, page: number): string {
  const params = new URLSearchParams();
  if (data.search) params.set("search", data.search);
  if (data.sort) params.set("sort", data.sort);
  if (data.direction) params.set("direction", data.direction);
  if (page > 1) params.set("page", String(page));
  for (const [key, value] of Object.entries(data.filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `/admin/${data.section.slug}${query ? `?${query}` : ""}`;
}

function readValue(record: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, record);
}

function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map((item) => formatValue(item)).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function labelize(value: string): string {
  return value.replaceAll(".", " / ").replaceAll("_", " ");
}
