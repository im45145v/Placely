import { createHash } from "node:crypto";
import { ID, Models, Query } from "node-appwrite";
import { Collections, DATABASE_ID } from "@/lib/appwrite/constants";
import { getCollectionRealtimeChannel } from "@/lib/appwrite/realtime";
import { createServerServices } from "@/lib/appwrite/server";
import { AppError } from "@/lib/errors";
import { requireStudentAccess } from "@/lib/auth/guards";
import { signFunctionPayload } from "@/lib/security/function-signing";
import { getServerEnv } from "@/lib/validation/env";
import type { AppUser, Notification, NotificationTemplate, NotificationType } from "@/types";

export const NOTIFICATION_TYPES = [
  "COMPANY_PUBLISHED",
  "APPLICATION_SUBMITTED",
  "SHORTLISTED",
  "ROUND_SCHEDULED",
  "ROUND_UPDATED",
  "RESULT_PUBLISHED",
  "DEADLINE_REMINDER",
  "ANNOUNCEMENT",
] as const satisfies readonly NotificationType[];

export interface NotificationTemplateDefinition {
  type: NotificationType;
  channel: "in_app" | "email";
  subjectTemplate: string;
  titleTemplate: string;
  bodyTemplate: string;
  variables: string[];
}

export interface NotificationDispatchEvent {
  type: NotificationType;
  universityId: string;
  templateKey?: string;
  recipientUserIds?: string[];
  variables?: Record<string, unknown>;
  dedupeKey?: string;
  entityId?: string;
  entityType?: string;
}

export interface NotificationListResult {
  notifications: Notification[];
  unreadCount: number;
}

const PAGE_SIZE = 20;

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplateDefinition[] = [
  {
    type: "COMPANY_PUBLISHED",
    channel: "in_app",
    subjectTemplate: "{{company_name}} has opened {{role_name}} applications",
    titleTemplate: "{{company_name}} published {{role_name}}",
    bodyTemplate: "Hi {{student_name}}, {{company_name}} has published the {{role_name}} role. Apply before {{deadline}}.",
    variables: ["student_name", "company_name", "role_name", "deadline"],
  },
  {
    type: "COMPANY_PUBLISHED",
    channel: "email",
    subjectTemplate: "{{company_name}} has opened {{role_name}} applications",
    titleTemplate: "{{company_name}} published {{role_name}}",
    bodyTemplate: "Hi {{student_name}}, {{company_name}} has published the {{role_name}} role. Apply before {{deadline}}.",
    variables: ["student_name", "company_name", "role_name", "deadline"],
  },
  {
    type: "APPLICATION_SUBMITTED",
    channel: "in_app",
    subjectTemplate: "Application submitted for {{role_name}}",
    titleTemplate: "Application submitted",
    bodyTemplate: "Your application to {{company_name}} for {{role_name}} has been submitted.",
    variables: ["student_name", "company_name", "role_name"],
  },
  {
    type: "APPLICATION_SUBMITTED",
    channel: "email",
    subjectTemplate: "Application submitted for {{role_name}}",
    titleTemplate: "Application submitted",
    bodyTemplate: "Hi {{student_name}}, your application to {{company_name}} for {{role_name}} has been submitted.",
    variables: ["student_name", "company_name", "role_name"],
  },
  {
    type: "SHORTLISTED",
    channel: "in_app",
    subjectTemplate: "You were shortlisted for {{role_name}}",
    titleTemplate: "Shortlisted by {{company_name}}",
    bodyTemplate: "You have been shortlisted for {{role_name}} at {{company_name}}.",
    variables: ["student_name", "company_name", "role_name"],
  },
  {
    type: "SHORTLISTED",
    channel: "email",
    subjectTemplate: "You were shortlisted for {{role_name}}",
    titleTemplate: "Shortlisted by {{company_name}}",
    bodyTemplate: "Hi {{student_name}}, you have been shortlisted for {{role_name}} at {{company_name}}.",
    variables: ["student_name", "company_name", "role_name"],
  },
  {
    type: "ROUND_SCHEDULED",
    channel: "in_app",
    subjectTemplate: "{{round_name}} scheduled for {{role_name}}",
    titleTemplate: "{{round_name}} scheduled",
    bodyTemplate: "{{company_name}} scheduled {{round_name}} for {{role_name}}. Check your application timeline for details.",
    variables: ["student_name", "company_name", "role_name", "round_name"],
  },
  {
    type: "ROUND_SCHEDULED",
    channel: "email",
    subjectTemplate: "{{round_name}} scheduled for {{role_name}}",
    titleTemplate: "{{round_name}} scheduled",
    bodyTemplate: "Hi {{student_name}}, {{company_name}} scheduled {{round_name}} for {{role_name}}.",
    variables: ["student_name", "company_name", "role_name", "round_name"],
  },
  {
    type: "ROUND_UPDATED",
    channel: "in_app",
    subjectTemplate: "{{round_name}} updated for {{role_name}}",
    titleTemplate: "{{round_name}} updated",
    bodyTemplate: "{{company_name}} updated the details for {{round_name}} in {{role_name}}.",
    variables: ["student_name", "company_name", "role_name", "round_name"],
  },
  {
    type: "ROUND_UPDATED",
    channel: "email",
    subjectTemplate: "{{round_name}} updated for {{role_name}}",
    titleTemplate: "{{round_name}} updated",
    bodyTemplate: "Hi {{student_name}}, {{company_name}} updated the details for {{round_name}} in {{role_name}}.",
    variables: ["student_name", "company_name", "role_name", "round_name"],
  },
  {
    type: "RESULT_PUBLISHED",
    channel: "in_app",
    subjectTemplate: "Result published for {{round_name}}",
    titleTemplate: "Result published",
    bodyTemplate: "{{company_name}} published your {{round_name}} result for {{role_name}}.",
    variables: ["student_name", "company_name", "role_name", "round_name"],
  },
  {
    type: "RESULT_PUBLISHED",
    channel: "email",
    subjectTemplate: "Result published for {{round_name}}",
    titleTemplate: "Result published",
    bodyTemplate: "Hi {{student_name}}, {{company_name}} published your {{round_name}} result for {{role_name}}.",
    variables: ["student_name", "company_name", "role_name", "round_name"],
  },
  {
    type: "DEADLINE_REMINDER",
    channel: "in_app",
    subjectTemplate: "{{role_name}} deadline reminder",
    titleTemplate: "Deadline reminder",
    bodyTemplate: "{{company_name}} closes applications for {{role_name}} on {{deadline}}.",
    variables: ["student_name", "company_name", "role_name", "deadline"],
  },
  {
    type: "DEADLINE_REMINDER",
    channel: "email",
    subjectTemplate: "{{role_name}} deadline reminder",
    titleTemplate: "Deadline reminder",
    bodyTemplate: "Hi {{student_name}}, {{company_name}} closes applications for {{role_name}} on {{deadline}}.",
    variables: ["student_name", "company_name", "role_name", "deadline"],
  },
  {
    type: "ANNOUNCEMENT",
    channel: "in_app",
    subjectTemplate: "{{title}}",
    titleTemplate: "{{title}}",
    bodyTemplate: "{{body}}",
    variables: ["student_name", "title", "body"],
  },
  {
    type: "ANNOUNCEMENT",
    channel: "email",
    subjectTemplate: "{{title}}",
    titleTemplate: "{{title}}",
    bodyTemplate: "Hi {{student_name}}, {{body}}",
    variables: ["student_name", "title", "body"],
  },
];

export async function listNotificationsForCurrentStudent(page = 1): Promise<NotificationListResult> {
  const actor = await requireStudentAccess();
  return listNotificationsForStudent(actor, page);
}

export async function listNotificationsForStudent(actor: AppUser, page = 1): Promise<NotificationListResult> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.NOTIFICATIONS,
    [
      Query.equal("userId", actor.$id),
      Query.orderDesc("createdAt"),
      Query.limit(PAGE_SIZE),
      Query.offset(Math.max(page - 1, 0) * PAGE_SIZE),
    ]
  );
  const unread = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.NOTIFICATIONS,
    [Query.equal("userId", actor.$id), Query.equal("isRead", false), Query.limit(100)]
  );

  return {
    notifications: result.documents.map(docToNotification),
    unreadCount: unread.total,
  };
}

export async function markNotificationRead(actor: AppUser, notificationId: string): Promise<Notification> {
  const { databases } = createServerServices();
  const existing = await databases.getDocument<Models.DefaultDocument>(DATABASE_ID, Collections.NOTIFICATIONS, notificationId);
  if (String(existing.userId) !== actor.$id) {
    throw AppError.notFound("Notification not found.");
  }
  if (existing.isRead) {
    return docToNotification(existing);
  }

  const now = new Date().toISOString();
  const updated = await databases.updateDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.NOTIFICATIONS,
    notificationId,
    { isRead: true, readAt: now, updatedAt: now }
  );
  return docToNotification(updated);
}

export async function markAllNotificationsRead(actor: AppUser): Promise<{ updated: number }> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.NOTIFICATIONS,
    [Query.equal("userId", actor.$id), Query.equal("isRead", false), Query.limit(100)]
  );
  if (result.documents.length === 0) {
    return { updated: 0 };
  }

  const now = new Date().toISOString();
  await Promise.all(result.documents.map((doc) =>
    databases.updateDocument(DATABASE_ID, Collections.NOTIFICATIONS, doc.$id, {
      isRead: true,
      readAt: now,
      updatedAt: now,
    })
  ));
  return { updated: result.documents.length };
}

export async function dispatchNotificationEvent(event: NotificationDispatchEvent): Promise<void> {
  const { APPWRITE_NOTIFICATION_FUNCTION_ID: functionId, APPWRITE_FUNCTION_SHARED_SECRET: sharedSecret } = getServerEnv();
  if (functionId) {
    if (!sharedSecret) {
      throw new Error("APPWRITE_FUNCTION_SHARED_SECRET is required when APPWRITE_NOTIFICATION_FUNCTION_ID is configured.");
    }
    const { functions } = createServerServices();
    await functions.createExecution(
      functionId,
      JSON.stringify(signFunctionPayload(event, sharedSecret)),
      true
    );
    return;
  }

  await processNotificationEventLocally(event);
}

export async function processNotificationEventLocally(event: NotificationDispatchEvent): Promise<void> {
  const { databases } = createServerServices();
  const templates = await ensureNotificationTemplates(event.universityId);
  const inAppTemplate = templates.find((template) => template.type === event.type && template.channel === "in_app" && template.isActive);
  if (!inAppTemplate) {
    return;
  }

  const recipientUserIds = event.recipientUserIds && event.recipientUserIds.length > 0
    ? Array.from(new Set(event.recipientUserIds.filter(Boolean)))
    : (await databases.listDocuments<Models.DefaultDocument>(
        DATABASE_ID,
        Collections.USERS,
        [Query.equal("universityId", event.universityId), Query.equal("role", "STUDENT"), Query.equal("isActive", true), Query.limit(500)]
      )).documents.map((doc) => doc.$id);

  const now = new Date().toISOString();
  await Promise.all(recipientUserIds.map(async (userId) => {
    const variables = { ...event.variables };
    const dedupeKey = buildNotificationDedupeKey(event, userId);
    const payload = {
      universityId: event.universityId,
      userId,
      type: event.type,
      templateKey: event.templateKey ?? `${event.type}:in_app`,
      dedupeKey,
      title: renderTemplate(inAppTemplate.titleTemplate, variables),
      body: renderTemplate(inAppTemplate.bodyTemplate, variables),
      data: {
        ...(variables ?? {}),
        entityId: event.entityId ?? null,
        entityType: event.entityType ?? null,
        realtimeChannel: getCollectionRealtimeChannel(Collections.NOTIFICATIONS),
      },
      isRead: false,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await databases.createDocument(DATABASE_ID, Collections.NOTIFICATIONS, ID.unique(), payload);
    } catch (error) {
      if (!isConflictError(error)) {
        throw error;
      }
    }
  }));
}

export async function ensureNotificationTemplates(universityId: string): Promise<NotificationTemplate[]> {
  const { databases } = createServerServices();
  const existing = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.NOTIFICATION_TEMPLATES,
    [Query.equal("universityId", universityId), Query.limit(100)]
  );
  const byKey = new Set(existing.documents.map((doc) => `${doc.type}:${doc.channel}`));
  const now = new Date().toISOString();

  await Promise.all(DEFAULT_NOTIFICATION_TEMPLATES.filter((template) => !byKey.has(`${template.type}:${template.channel}`)).map((template) =>
    databases.createDocument(DATABASE_ID, Collections.NOTIFICATION_TEMPLATES, ID.unique(), {
      universityId,
      type: template.type,
      channel: template.channel,
      subjectTemplate: template.subjectTemplate,
      titleTemplate: template.titleTemplate,
      bodyTemplate: template.bodyTemplate,
      variables: template.variables,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ));

  const refreshed = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.NOTIFICATION_TEMPLATES,
    [Query.equal("universityId", universityId), Query.limit(100)]
  );
  return refreshed.documents.map(docToNotificationTemplate);
}

export function buildNotificationDedupeKey(event: NotificationDispatchEvent, userId: string): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify({
    userId,
    type: event.type,
    universityId: event.universityId,
    entityId: event.entityId ?? null,
    entityType: event.entityType ?? null,
    templateKey: event.templateKey ?? null,
    dedupeKey: event.dedupeKey ?? null,
    variables: event.variables ?? null,
  }));
  return hash.digest("hex");
}

export function renderTemplate(template: string, variables?: Record<string, unknown>): string {
  return template.replaceAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables?.[key];
    return value === undefined || value === null || value === "" ? "N/A" : String(value);
  });
}

function docToNotification(doc: Models.DefaultDocument): Notification {
  return {
    $id: doc.$id,
    userId: String(doc.userId),
    universityId: String(doc.universityId),
    type: doc.type as NotificationType,
    templateKey: String(doc.templateKey ?? `${doc.type}:in_app`),
    dedupeKey: String(doc.dedupeKey ?? ""),
    title: String(doc.title),
    body: String(doc.body),
    data: (doc.data as Record<string, unknown> | null) ?? undefined,
    isRead: Boolean(doc.isRead),
    readAt: asOptionalString(doc.readAt),
    createdAt: String(doc.createdAt ?? doc.$createdAt),
    updatedAt: String(doc.updatedAt ?? doc.$updatedAt ?? doc.$createdAt),
  };
}

function docToNotificationTemplate(doc: Models.DefaultDocument): NotificationTemplate {
  return {
    $id: doc.$id,
    universityId: String(doc.universityId),
    type: doc.type as NotificationType,
    channel: doc.channel as NotificationTemplate["channel"],
    subjectTemplate: String(doc.subjectTemplate),
    titleTemplate: String(doc.titleTemplate),
    bodyTemplate: String(doc.bodyTemplate),
    variables: Array.isArray(doc.variables) ? doc.variables.map(String) : [],
    isActive: Boolean(doc.isActive),
    createdAt: String(doc.createdAt ?? doc.$createdAt),
    updatedAt: String(doc.updatedAt ?? doc.$updatedAt ?? doc.$createdAt),
  };
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isConflictError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && Number((error as { code?: unknown }).code) === 409;
}
