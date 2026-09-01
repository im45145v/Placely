import { Models, Query } from "node-appwrite";
import { createServerServices } from "@/lib/appwrite/server";
import { DATABASE_ID } from "@/lib/appwrite/constants";
import { listCompaniesForAdmin, listRolesForAdmin } from "@/lib/companies/service";
import { listApplicationsForAdmin, listPlacementRoundsForAdmin } from "@/lib/applications/service";
import { listVariablesForUniversity } from "@/lib/variables/service";
import { listSubmittedResumesForAdmin } from "@/lib/resumes/service";
import { listPlacementRulesForAdmin } from "@/lib/placement-rules/service";
import { listAuditLogs } from "@/lib/audit/service";
import { getAdminSection, type AdminSectionConfig } from "./registry";
import type { AppUser } from "@/types";

const PAGE_SIZE = 12;
const COLLECTION_READ_LIMIT = 200;

export interface AdminCollectionRecord {
  id: string;
  values: Record<string, unknown>;
}

export interface AdminCollectionPageData {
  section: AdminSectionConfig;
  records: AdminCollectionRecord[];
  columns: string[];
  total: number;
  totalPages: number;
  page: number;
  search: string;
  sort: string;
  direction: "asc" | "desc";
  filters: Record<string, string>;
}

export interface AdminDashboardSummary {
  metrics: Array<{ label: string; value: string; href: string }>;
  sections: Array<{ slug: string; label: string; description: string; count?: number }>;
}

export async function getAdminDashboardSummary(actor: AppUser): Promise<AdminDashboardSummary> {
  const [companies, roles, applications, rounds, variables, resumes, rules, counts] = await Promise.all([
    listCompaniesForAdmin(actor, { search: "", status: "all", page: 1 }),
    listRolesForAdmin(actor, { search: "", status: "all", page: 1 }),
    listApplicationsForAdmin(actor, { search: "", status: "all" as never, page: 1 }),
    listPlacementRoundsForAdmin(actor),
    listVariablesForUniversity(actor),
    listSubmittedResumesForAdmin(actor),
    listPlacementRulesForAdmin(actor),
    getAdminSectionCounts(actor),
  ]);

  return {
    metrics: [
      { label: "Companies", value: String(companies.total), href: "/admin/companies" },
      { label: "Roles", value: String(roles.total), href: "/admin/roles" },
      { label: "Applications", value: String(applications.total), href: "/admin/applications" },
      { label: "Rounds", value: String(rounds.length), href: "/admin/rounds" },
      { label: "Variables", value: String(variables.length), href: "/admin/variables" },
      { label: "Pending Resumes", value: String(resumes.length), href: "/admin/dashboard" },
      { label: "Placement Rules", value: String(rules.length), href: "/admin/eligibility" },
    ],
    sections: counts,
  };
}

export async function getAdminSectionCounts(actor: AppUser): Promise<AdminDashboardSummary["sections"]> {
  const sectionCounts = await Promise.all(
    [
      "students",
      "companies",
      "roles",
      "applications",
      "shortlists",
      "rounds",
      "results",
      "eligibility",
      "variables",
      "notifications",
      "announcements",
      "analytics",
      "reports",
      "documents",
      "audit-logs",
      "settings",
    ].map(async (slug) => {
      const section = getAdminSection(slug);
      if (!section) {
        return null;
      }
      const count = section.collectionId ? await countUniversityCollection(actor, section.collectionId) : undefined;
      return {
        slug: section.slug,
        label: section.label,
        description: section.description,
        count,
      };
    })
  );

  return sectionCounts.filter(Boolean) as AdminDashboardSummary["sections"];
}

export async function getAdminCollectionPage(
  actor: AppUser,
  sectionSlug: string,
  params: {
    search?: string;
    page?: number;
    sort?: string;
    direction?: "asc" | "desc";
    filters?: Record<string, string>;
  }
): Promise<AdminCollectionPageData> {
  const section = getAdminSection(sectionSlug);
  if (!section?.collectionId) {
    throw new Error("Unknown admin collection section.");
  }

  if (sectionSlug === "audit-logs") {
    const records = (await listAuditLogs(actor, {
      search: params.search,
      actorId: params.filters?.actorId,
      entityType: params.filters?.entityType,
      entityId: params.filters?.entityId,
      action: params.filters?.action,
      dateFrom: params.filters?.dateFrom,
      dateTo: params.filters?.dateTo,
    })).map((log) => ({ id: log.$id, values: log as unknown as Record<string, unknown> }));

    const page = Math.max(params.page ?? 1, 1);
    const total = records.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const start = (Math.min(page, totalPages) - 1) * PAGE_SIZE;

    return {
      section,
      records: records.slice(start, start + PAGE_SIZE),
      columns: section.columns?.length ? section.columns : inferColumns(records[0]?.values ?? {}),
      total,
      totalPages,
      page: Math.min(page, totalPages),
      search: params.search?.trim() ?? "",
      sort: params.sort || section.defaultSort || "timestamp",
      direction: params.direction || section.defaultDirection || "desc",
      filters: stripEmpty(params.filters ?? {}),
    };
  }

  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(DATABASE_ID, section.collectionId, [
    Query.equal("universityId", actor.universityId),
    Query.limit(COLLECTION_READ_LIMIT),
  ]);

  const search = params.search?.trim() ?? "";
  const sort = params.sort || section.defaultSort || "updatedAt";
  const direction = params.direction || section.defaultDirection || "desc";
  const filters = stripEmpty(params.filters ?? {});

  let records = result.documents.map((doc) => ({
    id: doc.$id,
    values: normalizeDocument(doc),
  }));

  records = records.filter((record) => matchesFilters(record.values, filters));
  if (search) {
    records = records.filter((record) => matchesSearch(record.values, search, section.searchableFields));
  }

  records.sort((left, right) => compareValues(readPath(left.values, sort), readPath(right.values, sort), direction));

  const page = Math.max(params.page ?? 1, 1);
  const total = records.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (Math.min(page, totalPages) - 1) * PAGE_SIZE;
  const paginated = records.slice(start, start + PAGE_SIZE);
  const columns = section.columns?.length ? section.columns : inferColumns(paginated[0]?.values ?? records[0]?.values ?? {});

  return {
    section,
    records: paginated,
    columns,
    total,
    totalPages,
    page: Math.min(page, totalPages),
    search,
    sort,
    direction,
    filters,
  };
}

async function countUniversityCollection(actor: AppUser, collectionId: string): Promise<number> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(DATABASE_ID, collectionId, [
    Query.equal("universityId", actor.universityId),
    Query.limit(1),
  ]);
  return result.total;
}

function normalizeDocument(doc: Models.DefaultDocument): Record<string, unknown> {
  const values = { ...doc } as Record<string, unknown>;
  values.$id = doc.$id;
  values.$createdAt = doc.$createdAt;
  values.$updatedAt = doc.$updatedAt;
  return values;
}

function stripEmpty(filters: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value.trim()));
}

function matchesFilters(record: Record<string, unknown>, filters: Record<string, string>): boolean {
  return Object.entries(filters).every(([key, value]) => {
    if (key === "dateFrom" || key === "dateTo") {
      const timestamp = readPath(record, "timestamp");
      if (typeof timestamp !== "string") {
        return false;
      }
      const current = new Date(timestamp).getTime();
      const boundary = new Date(value).getTime();
      return key === "dateFrom" ? current >= boundary : current <= boundary;
    }
    const current = readPath(record, key);
    if (Array.isArray(current)) {
      return current.some((item) => String(item) === value);
    }
    return String(current) === value;
  });
}

function matchesSearch(record: Record<string, unknown>, search: string, fields?: string[]): boolean {
  const haystack = (fields?.length ? fields.map((field) => readPath(record, field)) : Object.values(record))
    .flatMap((value) => flattenValue(value))
    .join(" ")
    .toLowerCase();
  return haystack.includes(search.toLowerCase());
}

function flattenValue(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap((item) => flattenValue(item));
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap((item) => flattenValue(item));
  return [String(value)];
}

function readPath(record: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, record);
}

function compareValues(left: unknown, right: unknown, direction: "asc" | "desc"): number {
  const normalizedLeft = normalizeComparable(left);
  const normalizedRight = normalizeComparable(right);

  if (normalizedLeft < normalizedRight) return direction === "asc" ? -1 : 1;
  if (normalizedLeft > normalizedRight) return direction === "asc" ? 1 : -1;
  return 0;
}

function normalizeComparable(value: unknown): string | number {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const asDate = Date.parse(value);
    return Number.isNaN(asDate) ? value.toLowerCase() : asDate;
  }
  if (value == null) return "";
  return JSON.stringify(value).toLowerCase();
}

function inferColumns(record: Record<string, unknown>): string[] {
  const preferred = ["name", "title", "status", "type", "updatedAt", "createdAt", "$id"];
  const keys = Object.keys(record).filter((key) => !key.startsWith("$"));
  return [...preferred.filter((key) => keys.includes(key)), ...keys.filter((key) => !preferred.includes(key))].slice(0, 7);
}
