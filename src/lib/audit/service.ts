import { ID, Models, Query } from "node-appwrite";
import { Collections, DATABASE_ID } from "@/lib/appwrite/constants";
import { createServerServices } from "@/lib/appwrite/server";
import type { AppUser, AuditLog } from "@/types";

export interface CreateAuditLogInput {
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp?: string;
}

export async function createAuditLog(actor: AppUser, input: CreateAuditLogInput): Promise<AuditLog> {
  const { databases } = createServerServices();
  const timestamp = input.timestamp ?? new Date().toISOString();
  const doc = await databases.createDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.AUDIT_LOGS,
    ID.unique(),
    {
      universityId: actor.universityId,
      actorId: actor.$id,
      actorRole: actor.role,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorName: actor.name,
      actorEmail: actor.email,
      previousValue: input.previousValue ?? null,
      newValue: input.newValue ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      timestamp,
    }
  );

  return {
    $id: doc.$id,
    universityId: String(doc.universityId),
    actorId: String(doc.actorId),
    actorRole: doc.actorRole as AuditLog["actorRole"],
    action: String(doc.action),
    entityType: String(doc.entityType),
    entityId: String(doc.entityId),
    actorName: (doc.actorName as string | null) ?? undefined,
    actorEmail: (doc.actorEmail as string | null) ?? undefined,
    previousValue: (doc.previousValue as Record<string, unknown> | null) ?? undefined,
    newValue: (doc.newValue as Record<string, unknown> | null) ?? undefined,
    ipAddress: (doc.ipAddress as string | null) ?? undefined,
    userAgent: (doc.userAgent as string | null) ?? undefined,
    timestamp: String(doc.timestamp ?? doc.$createdAt),
  };
}

export interface AuditLogFilters {
  search?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function listAuditLogs(actor: AppUser, filters: AuditLogFilters = {}): Promise<AuditLog[]> {
  const { databases } = createServerServices();
  const queries = [Query.equal("universityId", actor.universityId), Query.limit(200)];
  if (filters.actorId) queries.splice(queries.length - 1, 0, Query.equal("actorId", filters.actorId));
  if (filters.entityType) queries.splice(queries.length - 1, 0, Query.equal("entityType", filters.entityType));
  if (filters.entityId) queries.splice(queries.length - 1, 0, Query.equal("entityId", filters.entityId));
  if (filters.action) queries.splice(queries.length - 1, 0, Query.equal("action", filters.action));
  if (filters.dateFrom) queries.splice(queries.length - 1, 0, Query.greaterThanEqual("timestamp", filters.dateFrom));
  if (filters.dateTo) {
    const endOfDay = new Date(filters.dateTo);
    endOfDay.setUTCHours(23, 59, 59, 999);
    queries.splice(queries.length - 1, 0, Query.lessThanEqual("timestamp", endOfDay.toISOString()));
  }

  const result = await databases.listDocuments<Models.DefaultDocument>(DATABASE_ID, Collections.AUDIT_LOGS, queries);
  const search = filters.search?.trim().toLowerCase();

  return result.documents
    .map((doc) => ({
      $id: doc.$id,
      universityId: String(doc.universityId),
      actorId: String(doc.actorId),
      actorRole: doc.actorRole as AuditLog["actorRole"],
      action: String(doc.action),
      entityType: String(doc.entityType),
      entityId: String(doc.entityId),
      actorName: (doc.actorName as string | null) ?? undefined,
      actorEmail: (doc.actorEmail as string | null) ?? undefined,
      previousValue: (doc.previousValue as Record<string, unknown> | null) ?? undefined,
      newValue: (doc.newValue as Record<string, unknown> | null) ?? undefined,
      ipAddress: (doc.ipAddress as string | null) ?? undefined,
      userAgent: (doc.userAgent as string | null) ?? undefined,
      timestamp: String(doc.timestamp ?? doc.$createdAt),
    }))
    .filter((log) => {
      if (!search) return true;
      const haystack = [
        log.action,
        log.entityType,
        log.entityId,
        log.actorId,
        log.actorName,
        log.actorEmail,
        log.actorRole,
        log.userAgent,
        JSON.stringify(log.previousValue ?? {}),
        JSON.stringify(log.newValue ?? {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    })
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
}
