"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { Company } from "@/types";

interface PaginatedCompanies {
  items: Company[];
  page: number;
  totalPages: number;
  total: number;
}

export function AdminCompaniesManager({
  initialCompanies,
  search,
  status,
}: {
  initialCompanies: PaginatedCompanies;
  search: string;
  status: string;
}) {
  const [companies, setCompanies] = useState(initialCompanies.items);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>, companyId?: string): void {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const response = await fetch(companyId ? `/api/admin/companies/${companyId}` : "/api/admin/companies", {
        method: companyId ? "PATCH" : "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Failed to save company.");
        return;
      }
      if (companyId) {
        setCompanies((current) => current.map((item) => (item.$id === companyId ? data : item)));
        setEditingId(null);
        setMessage("Company updated.");
      } else {
        setCompanies((current) => [data, ...current]);
        form.reset();
        setMessage("Company created.");
      }
    });
  }

  function archiveCompany(companyId: string): void {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/companies/${companyId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Failed to archive company.");
        return;
      }
      setCompanies((current) => current.map((item) => (item.$id === companyId ? data : item)));
      setMessage("Company archived.");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create company</CardTitle>
          <CardDescription>Companies and roles are modeled separately. A single company can hold many roles.</CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyForm onSubmit={handleSubmit} isPending={isPending} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company directory</CardTitle>
          <CardDescription>
            Showing {companies.length} of {initialCompanies.total} companies for search &quot;{search || "all"}&quot; and status &quot;{status}&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {companies.map((company) => (
            <div key={company.$id} className="rounded-md border border-border p-4">
              {editingId === company.$id ? (
                <CompanyForm
                  company={company}
                  onSubmit={(event) => handleSubmit(event, company.$id)}
                  onCancel={() => setEditingId(null)}
                  isPending={isPending}
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      {company.logo ? (
                        <Image
                          src={`/api/files/company-logo/${company.$id}`}
                          alt={`${company.name} logo`}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-md border border-border object-cover"
                        />
                      ) : null}
                      <div>
                        <p className="text-sm font-medium">{company.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {company.industry ?? "No industry"} • {company.isActive ? "Active" : "Archived"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {company.locations.join(", ") || "No locations"} {company.website ? `• ${company.website}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(company.$id)}>
                      Edit
                    </Button>
                    {company.isActive ? (
                      <Button type="button" variant="danger" size="sm" onClick={() => archiveCompany(company.$id)} loading={isPending}>
                        Archive
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ))}
          {(message || error) && (
            <p className={error ? "text-sm text-destructive" : "text-sm text-foreground"}>
              {error ?? message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyForm({
  company,
  onSubmit,
  onCancel,
  isPending,
}: {
  company?: Company;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  isPending: boolean;
}) {
  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
      <Field label="Company name" name="name" defaultValue={company?.name} required />
      <Field label="Website" name="website" defaultValue={company?.website} />
      <Field label="Industry" name="industry" defaultValue={company?.industry} />
      <Field label="Company type" name="companyType" defaultValue={company?.companyType} />
      <TextAreaField label="Description" name="description" defaultValue={company?.description} className="md:col-span-2" />
      <TextAreaField label="Locations" name="locations" defaultValue={company?.locations.join("\n")} className="md:col-span-2" />
      <Field label="Contact name" name="contactName" defaultValue={company?.contactInfo?.name} />
      <Field label="Contact email" name="contactEmail" defaultValue={company?.contactInfo?.email} />
      <Field label="Contact phone" name="contactPhone" defaultValue={company?.contactInfo?.phone} />
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Logo</span>
        <input type="file" name="logo" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" className="rounded-md border border-input bg-background px-3 py-2" />
      </label>
      <div className="md:col-span-2 flex gap-2">
        <Button type="submit" loading={isPending}>{company ? "Save company" : "Create company"}</Button>
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button> : null}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <input name={name} type={type} required={required} defaultValue={defaultValue} className="rounded-md border border-input bg-background px-3 py-2" />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
  className,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-2 text-sm ${className ?? ""}`}>
      <span className="font-medium">{label}</span>
      <textarea name={name} defaultValue={defaultValue} className="min-h-28 rounded-md border border-input bg-background px-3 py-2" />
    </label>
  );
}
