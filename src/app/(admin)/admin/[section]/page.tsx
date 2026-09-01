import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/feedback/EmptyState";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { AdminCollectionExplorer } from "@/features/admin/AdminCollectionExplorer";
import { AdminOverview } from "@/features/admin/AdminOverview";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { getAdminSection } from "@/lib/admin/registry";
import { getAdminCollectionPage, getAdminDashboardSummary } from "@/lib/admin/service";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  const config = getAdminSection(section);
  return {
    title: config ? `Admin ${config.label}` : "Admin",
  };
}

export default async function GenericAdminSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireRoleAccess(ADMIN_ROLES);
  const { section } = await params;
  const config = getAdminSection(section);

  if (!config || ["companies", "roles", "applications", "variables", "analytics"].includes(section)) {
    notFound();
  }

  const query = searchParams ? await searchParams : {};

  if (section === "dashboard") {
    const summary = await getAdminDashboardSummary(actor);
    return (
      <PageWrapper>
        <PageHeader title="Admin Dashboard" description={config.description} />
        <AdminOverview summary={summary} />
      </PageWrapper>
    );
  }

  if (!config.collectionId) {
    return (
      <PageWrapper>
        <PageHeader title={config.label} description={config.description} />
        <EmptyState title="Section unavailable" description="This admin section does not have a collection-backed explorer." />
      </PageWrapper>
    );
  }

  let data;
  let loadError: string | null = null;
  try {
    data = await getAdminCollectionPage(actor, section, {
      search: readParam(query.search),
      page: Number(readParam(query.page) || "1"),
      sort: readParam(query.sort),
      direction: readDirection(readParam(query.direction)),
      filters: {
        ...Object.fromEntries((config.filterFields ?? []).map((field) => [field.key, readParam(query[field.key]) || ""])),
        ...(section === "audit-logs"
          ? {
              actorId: readParam(query.actorId),
              entityType: readParam(query.entityType),
              entityId: readParam(query.entityId),
              action: readParam(query.action),
              dateFrom: readParam(query.dateFrom),
              dateTo: readParam(query.dateTo),
            }
          : {}),
      },
    });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "An unexpected error occurred while reading this admin section.";
  }

  return (
    <PageWrapper>
      <PageHeader title={config.label} description={config.description} />
      <AdminSectionFilters section={config} query={query} />
      {loadError || !data ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load {config.label.toLowerCase()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{loadError ?? "Unexpected admin loading failure."}</p>
          </CardContent>
        </Card>
      ) : (
        <AdminCollectionExplorer data={data} />
      )}
    </PageWrapper>
  );
}

function AdminSectionFilters({
  section,
  query,
}: {
  section: NonNullable<ReturnType<typeof getAdminSection>>;
  query: Record<string, string | string[] | undefined>;
}) {
  return (
    <form action={`/admin/${section.slug}`} className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-2 xl:grid-cols-5">
      <input
        name="search"
        defaultValue={readParam(query.search)}
        placeholder={`Search ${section.label.toLowerCase()}`}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <select name="sort" defaultValue={readParam(query.sort) || section.defaultSort || "updatedAt"} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
        {(section.columns ?? []).map((column) => (
          <option key={column} value={column}>{column.replaceAll(".", " / ").replaceAll("_", " ")}</option>
        ))}
      </select>
      <select name="direction" defaultValue={readParam(query.direction) || section.defaultDirection || "desc"} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
        <option value="desc">Newest first</option>
        <option value="asc">Oldest first</option>
      </select>
      {(section.filterFields ?? []).map((field) => (
        <select key={field.key} name={field.key} defaultValue={readParam(query[field.key])} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">{field.label}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ))}
      {section.slug === "audit-logs" ? (
        <>
          <input name="actorId" defaultValue={readParam(query.actorId)} placeholder="Actor ID" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input name="entityType" defaultValue={readParam(query.entityType)} placeholder="Entity type" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input name="entityId" defaultValue={readParam(query.entityId)} placeholder="Entity ID" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input name="action" defaultValue={readParam(query.action)} placeholder="Action" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input type="date" name="dateFrom" defaultValue={readParam(query.dateFrom)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input type="date" name="dateTo" defaultValue={readParam(query.dateTo)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </>
      ) : null}
      <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Apply</button>
    </form>
  );
}

function readParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function readDirection(value: string): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}
