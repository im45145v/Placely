import { createHash } from "node:crypto";
import { Client, Databases, ID, Query } from "node-appwrite";

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;
const ENDPOINT = process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? "https://cloud.appwrite.io/v1";

const Collections = {
  USERS: "users",
  NOTIFICATIONS: "notifications",
  NOTIFICATION_TEMPLATES: "notification_templates",
};

const DEFAULT_TEMPLATES = [
  ["COMPANY_PUBLISHED", "in_app", "{{company_name}} has opened {{role_name}} applications", "{{company_name}} published {{role_name}}", "Hi {{student_name}}, {{company_name}} has published the {{role_name}} role. Apply before {{deadline}}.", ["student_name", "company_name", "role_name", "deadline"]],
  ["COMPANY_PUBLISHED", "email", "{{company_name}} has opened {{role_name}} applications", "{{company_name}} published {{role_name}}", "Hi {{student_name}}, {{company_name}} has published the {{role_name}} role. Apply before {{deadline}}.", ["student_name", "company_name", "role_name", "deadline"]],
  ["APPLICATION_SUBMITTED", "in_app", "Application submitted for {{role_name}}", "Application submitted", "Your application to {{company_name}} for {{role_name}} has been submitted.", ["student_name", "company_name", "role_name"]],
  ["APPLICATION_SUBMITTED", "email", "Application submitted for {{role_name}}", "Application submitted", "Hi {{student_name}}, your application to {{company_name}} for {{role_name}} has been submitted.", ["student_name", "company_name", "role_name"]],
  ["SHORTLISTED", "in_app", "You were shortlisted for {{role_name}}", "Shortlisted by {{company_name}}", "You have been shortlisted for {{role_name}} at {{company_name}}.", ["student_name", "company_name", "role_name"]],
  ["SHORTLISTED", "email", "You were shortlisted for {{role_name}}", "Shortlisted by {{company_name}}", "Hi {{student_name}}, you have been shortlisted for {{role_name}} at {{company_name}}.", ["student_name", "company_name", "role_name"]],
  ["ROUND_SCHEDULED", "in_app", "{{round_name}} scheduled for {{role_name}}", "{{round_name}} scheduled", "{{company_name}} scheduled {{round_name}} for {{role_name}}. Check your application timeline for details.", ["student_name", "company_name", "role_name", "round_name"]],
  ["ROUND_SCHEDULED", "email", "{{round_name}} scheduled for {{role_name}}", "{{round_name}} scheduled", "Hi {{student_name}}, {{company_name}} scheduled {{round_name}} for {{role_name}}.", ["student_name", "company_name", "role_name", "round_name"]],
  ["ROUND_UPDATED", "in_app", "{{round_name}} updated for {{role_name}}", "{{round_name}} updated", "{{company_name}} updated the details for {{round_name}} in {{role_name}}.", ["student_name", "company_name", "role_name", "round_name"]],
  ["ROUND_UPDATED", "email", "{{round_name}} updated for {{role_name}}", "{{round_name}} updated", "Hi {{student_name}}, {{company_name}} updated the details for {{round_name}} in {{role_name}}.", ["student_name", "company_name", "role_name", "round_name"]],
  ["RESULT_PUBLISHED", "in_app", "Result published for {{round_name}}", "Result published", "{{company_name}} published your {{round_name}} result for {{role_name}}.", ["student_name", "company_name", "role_name", "round_name"]],
  ["RESULT_PUBLISHED", "email", "Result published for {{round_name}}", "Result published", "Hi {{student_name}}, {{company_name}} published your {{round_name}} result for {{role_name}}.", ["student_name", "company_name", "role_name", "round_name"]],
  ["DEADLINE_REMINDER", "in_app", "{{role_name}} deadline reminder", "Deadline reminder", "{{company_name}} closes applications for {{role_name}} on {{deadline}}.", ["student_name", "company_name", "role_name", "deadline"]],
  ["DEADLINE_REMINDER", "email", "{{role_name}} deadline reminder", "Deadline reminder", "Hi {{student_name}}, {{company_name}} closes applications for {{role_name}} on {{deadline}}.", ["student_name", "company_name", "role_name", "deadline"]],
  ["ANNOUNCEMENT", "in_app", "{{title}}", "{{title}}", "{{body}}", ["student_name", "title", "body"]],
  ["ANNOUNCEMENT", "email", "{{title}}", "{{title}}", "Hi {{student_name}}, {{body}}", ["student_name", "title", "body"]],
];

export default async function main({ req, res }) {
  if (!DATABASE_ID || !API_KEY || !PROJECT_ID) {
    return res.json({ ok: false, error: "Missing function environment variables." }, 500);
  }

  const event = safeJsonParse(req.body ?? "{}");
  if (!event || typeof event.type !== "string" || typeof event.universityId !== "string") {
    return res.json({ ok: false, error: "type and universityId are required." }, 400);
  }

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);
  await ensureTemplates(databases, event.universityId);
  const templates = await loadTemplates(databases, event.universityId);
  const inApp = templates.find((template) => template.type === event.type && template.channel === "in_app" && template.isActive);
  const email = templates.find((template) => template.type === event.type && template.channel === "email" && template.isActive);
  if (!inApp) {
    return res.json({ ok: true, created: 0, skipped: "No active in-app template." });
  }

  const recipients = await resolveRecipients(databases, event);
  const emailSender = createEmailSender();
  let created = 0;

  for (const recipient of recipients) {
    const variables = { ...event.variables, student_name: event.variables?.student_name ?? recipient.name };
    const dedupeKey = buildDedupeKey(event, recipient.$id);
    try {
      await databases.createDocument(DATABASE_ID, Collections.NOTIFICATIONS, ID.unique(), {
        userId: recipient.$id,
        universityId: event.universityId,
        type: event.type,
        templateKey: event.templateKey ?? `${event.type}:in_app`,
        dedupeKey,
        title: renderTemplate(inApp.titleTemplate, variables),
        body: renderTemplate(inApp.bodyTemplate, variables),
        data: {
          ...(event.variables ?? {}),
          entityId: event.entityId ?? null,
          entityType: event.entityType ?? null,
        },
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      created += 1;
    } catch (error) {
      if (!isConflictError(error)) {
        throw error;
      }
    }

    if (email && recipient.email) {
      await emailSender.send({
        to: recipient.email,
        subject: renderTemplate(email.subjectTemplate, variables),
        title: renderTemplate(email.titleTemplate, variables),
        body: renderTemplate(email.bodyTemplate, variables),
        metadata: {
          type: event.type,
          userId: recipient.$id,
          dedupeKey,
        },
      });
    }
  }

  return res.json({ ok: true, created, recipients: recipients.length });
}

async function ensureTemplates(databases, universityId) {
  const existing = await databases.listDocuments(DATABASE_ID, Collections.NOTIFICATION_TEMPLATES, [
    Query.equal("universityId", universityId),
    Query.limit(100),
  ]);
  const keys = new Set(existing.documents.map((doc) => `${doc.type}:${doc.channel}`));
  const now = new Date().toISOString();

  for (const [type, channel, subjectTemplate, titleTemplate, bodyTemplate, variables] of DEFAULT_TEMPLATES) {
    if (keys.has(`${type}:${channel}`)) {
      continue;
    }
    await databases.createDocument(DATABASE_ID, Collections.NOTIFICATION_TEMPLATES, ID.unique(), {
      universityId,
      type,
      channel,
      subjectTemplate,
      titleTemplate,
      bodyTemplate,
      variables,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function loadTemplates(databases, universityId) {
  const result = await databases.listDocuments(DATABASE_ID, Collections.NOTIFICATION_TEMPLATES, [
    Query.equal("universityId", universityId),
    Query.limit(100),
  ]);
  return result.documents;
}

async function resolveRecipients(databases, event) {
  if (Array.isArray(event.recipientUserIds) && event.recipientUserIds.length > 0) {
    return Promise.all(event.recipientUserIds.map(async (userId) => {
      const doc = await databases.getDocument(DATABASE_ID, Collections.USERS, String(userId));
      return { $id: doc.$id, name: String(doc.name), email: String(doc.email || "") };
    }));
  }

  const result = await databases.listDocuments(DATABASE_ID, Collections.USERS, [
    Query.equal("universityId", event.universityId),
    Query.equal("role", "STUDENT"),
    Query.equal("isActive", true),
    Query.limit(500),
  ]);
  return result.documents.map((doc) => ({ $id: doc.$id, name: String(doc.name), email: String(doc.email || "") }));
}

function buildDedupeKey(event, userId) {
  return createHash("sha256").update(JSON.stringify({
    type: event.type,
    universityId: event.universityId,
    userId,
    entityId: event.entityId ?? null,
    entityType: event.entityType ?? null,
    templateKey: event.templateKey ?? null,
    dedupeKey: event.dedupeKey ?? null,
    variables: event.variables ?? null,
  })).digest("hex");
}

function renderTemplate(template, variables) {
  return String(template).replaceAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = variables?.[key];
    return value === undefined || value === null || value === "" ? "N/A" : String(value);
  });
}

function createEmailSender() {
  return {
    async send(message) {
      console.log("[notification-email]", JSON.stringify(message));
    },
  };
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function isConflictError(error) {
  return typeof error === "object" && error !== null && Number(error.code) === 409;
}
