import { ID, Models } from "node-appwrite";
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
}

export async function createAuditLog(actor: AppUser, input: CreateAuditLogInput): Promise<AuditLog> {
  const { databases } = createServerServices();
  const timestamp = new Date().toISOString();
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
    previousValue: (doc.previousValue as Record<string, unknown> | null) ?? undefined,
    newValue: (doc.newValue as Record<string, unknown> | null) ?? undefined,
    ipAddress: (doc.ipAddress as string | null) ?? undefined,
    userAgent: (doc.userAgent as string | null) ?? undefined,
    timestamp: String(doc.timestamp ?? doc.$createdAt),
  };
}
