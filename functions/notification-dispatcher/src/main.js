import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Client, Databases, ID, Query } from "node-appwrite";

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;
const ENDPOINT = process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const EMAIL_AUTOMATION_PROVIDER = (process.env.EMAIL_AUTOMATION_PROVIDER ?? "log").trim().toLowerCase();
const GOOGLE_APPS_SCRIPT_WEB_APP_URL = process.env.GOOGLE_APPS_SCRIPT_WEB_APP_URL?.trim() ?? "";
const GOOGLE_APPS_SCRIPT_AUTH_TOKEN = process.env.GOOGLE_APPS_SCRIPT_AUTH_TOKEN?.trim() ?? "";
const FUNCTION_SHARED_SECRET = process.env.APPWRITE_FUNCTION_SHARED_SECRET?.trim() ?? "";
const SIGNATURE_MAX_AGE_SECONDS = 300;

const MAX_EMAIL_ATTEMPTS = 5;
const MAX_IMMEDIATE_RETRIES_PER_EXECUTION = 2;
const STALE_SENDING_WINDOW_MS = 10 * 60 * 1000;

const Collections = {
  USERS: "users",
  NOTIFICATIONS: "notifications",
  EMAIL_DELIVERIES: "email_deliveries",
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
  if (!DATABASE_ID || !API_KEY || !PROJECT_ID || !FUNCTION_SHARED_SECRET) {
    return res.json({ ok: false, error: "Missing function environment variables." }, 500);
  }

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);
  const body = safeJsonParse(req.body ?? "{}");
  const verification = verifySignedPayload(body, FUNCTION_SHARED_SECRET);
  if (!verification.ok) {
    return res.json({ ok: false, error: verification.reason }, 401);
  }
  const payload = extractSignedPayload(body);

  if (payload.mode === "retry_due") {
    const retried = await processDueEmailDeliveries(databases);
    return res.json({ ok: true, mode: "retry_due", processed: retried.length, deliveries: retried });
  }

  if (typeof payload.type !== "string" || typeof payload.universityId !== "string") {
    return res.json({ ok: false, error: "type and universityId are required." }, 400);
  }

  await ensureTemplates(databases, payload.universityId);
  const templates = await loadTemplates(databases, payload.universityId);
  const inApp = templates.find((template) => template.type === payload.type && template.channel === "in_app" && template.isActive);
  const email = templates.find((template) => template.type === payload.type && template.channel === "email" && template.isActive);
  if (!inApp && !email) {
    return res.json({ ok: true, created: 0, emailed: 0, skipped: "No active templates." });
  }

  const recipients = await resolveRecipients(databases, payload);
  const emailSender = createEmailSender();
  let created = 0;
  let emailed = 0;
  const emailResults = [];

  for (const recipient of recipients) {
    const variables = { ...payload.variables, student_name: payload.variables?.student_name ?? recipient.name };
    const notificationDedupeKey = buildDedupeKey(payload, recipient.$id, "in_app");
    const emailDedupeKey = buildDedupeKey(payload, recipient.$id, "email");

    if (inApp) {
      try {
        await databases.createDocument(DATABASE_ID, Collections.NOTIFICATIONS, ID.unique(), {
          userId: recipient.$id,
          universityId: payload.universityId,
          type: payload.type,
          templateKey: payload.templateKey ?? `${payload.type}:in_app`,
          dedupeKey: notificationDedupeKey,
          title: renderTemplate(inApp.titleTemplate, variables),
          body: renderTemplate(inApp.bodyTemplate, variables),
          data: {
            ...(payload.variables ?? {}),
            entityId: payload.entityId ?? null,
            entityType: payload.entityType ?? null,
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
    }

    if (!email || !recipient.email) {
      continue;
    }

    const delivery = await findOrCreateEmailDelivery(databases, {
      dedupeKey: emailDedupeKey,
      userId: recipient.$id,
      universityId: payload.universityId,
      notificationType: payload.type,
      templateKey: payload.templateKey ?? `${payload.type}:email`,
      toEmail: recipient.email,
      subject: renderTemplate(email.subjectTemplate, variables),
      title: renderTemplate(email.titleTemplate, variables),
      body: renderTemplate(email.bodyTemplate, variables),
      payload: {
        ...(payload.variables ?? {}),
        entityId: payload.entityId ?? null,
        entityType: payload.entityType ?? null,
        metadata: {
          type: payload.type,
          userId: recipient.$id,
          dedupeKey: emailDedupeKey,
        },
      },
      provider: emailSender.provider,
    });

    const result = await processEmailDelivery(databases, emailSender, delivery);
    emailResults.push({
      deliveryId: result.$id,
      status: result.status,
      attempts: result.attempts,
      nextAttemptAt: result.nextAttemptAt ?? null,
    });
    if (result.status === "sent") {
      emailed += 1;
    }
  }

  return res.json({ ok: true, created, emailed, recipients: recipients.length, emailResults });
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
      return { $id: doc.$id, name: String(doc.name), email: normalizeEmail(doc.email) };
    }));
  }

  const result = await databases.listDocuments(DATABASE_ID, Collections.USERS, [
    Query.equal("universityId", event.universityId),
    Query.equal("role", "STUDENT"),
    Query.equal("isActive", true),
    Query.limit(500),
  ]);
  return result.documents.map((doc) => ({ $id: doc.$id, name: String(doc.name), email: normalizeEmail(doc.email) }));
}

async function findOrCreateEmailDelivery(databases, input) {
  const now = new Date().toISOString();
  const payload = {
    userId: input.userId,
    universityId: input.universityId,
    notificationType: input.notificationType,
    templateKey: input.templateKey,
    dedupeKey: input.dedupeKey,
    provider: input.provider,
    status: "pending",
    toEmail: input.toEmail,
    subject: input.subject,
    title: input.title,
    body: input.body,
    payload: input.payload,
    attempts: 0,
    maxAttempts: MAX_EMAIL_ATTEMPTS,
    lastAttemptAt: null,
    nextAttemptAt: now,
    sentAt: null,
    providerMessageId: null,
    providerResponse: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    return await databases.createDocument(DATABASE_ID, Collections.EMAIL_DELIVERIES, ID.unique(), payload);
  } catch (error) {
    if (!isConflictError(error)) {
      throw error;
    }
  }

  const existing = await databases.listDocuments(DATABASE_ID, Collections.EMAIL_DELIVERIES, [
    Query.equal("dedupeKey", input.dedupeKey),
    Query.limit(1),
  ]);
  if (!existing.documents[0]) {
    throw new Error(`Email delivery conflict without existing document for ${input.dedupeKey}.`);
  }
  return existing.documents[0];
}

async function processDueEmailDeliveries(databases) {
  const now = new Date().toISOString();
  const result = await databases.listDocuments(DATABASE_ID, Collections.EMAIL_DELIVERIES, [
    Query.equal("status", ["pending", "retrying", "sending"]),
    Query.lessThanEqual("nextAttemptAt", now),
    Query.limit(50),
  ]);
  const emailSender = createEmailSender();
  const processed = [];

  for (const delivery of result.documents) {
    const updated = await processEmailDelivery(databases, emailSender, delivery);
    processed.push({
      deliveryId: updated.$id,
      status: updated.status,
      attempts: updated.attempts,
      nextAttemptAt: updated.nextAttemptAt ?? null,
    });
  }

  return processed;
}

async function processEmailDelivery(databases, emailSender, delivery) {
  let current = delivery;
  if (!shouldAttemptDelivery(current)) {
    return current;
  }

  for (let retryIndex = 0; retryIndex < MAX_IMMEDIATE_RETRIES_PER_EXECUTION; retryIndex += 1) {
    current = await markEmailAttemptStarted(databases, current);
    try {
      const response = await emailSender.send({
        to: String(current.toEmail),
        subject: String(current.subject),
        title: String(current.title),
        body: String(current.body),
        text: buildTextEmailBody(current),
        html: buildHtmlEmailBody(current),
        metadata: {
          dedupeKey: String(current.dedupeKey),
          notificationType: String(current.notificationType),
          templateKey: String(current.templateKey),
          userId: String(current.userId),
        },
      });
      current = await databases.updateDocument(DATABASE_ID, Collections.EMAIL_DELIVERIES, current.$id, {
        status: "sent",
        sentAt: new Date().toISOString(),
        nextAttemptAt: null,
        providerMessageId: response.messageId ?? null,
        providerResponse: response.raw ?? null,
        lastError: null,
        updatedAt: new Date().toISOString(),
      });
      return current;
    } catch (error) {
      const retryDecision = await handleEmailFailure(databases, current, error);
      current = retryDecision.delivery;
      if (!retryDecision.shouldRetryNow) {
        return current;
      }
      await delay(retryDecision.delayMs);
    }
  }

  return current;
}

function shouldAttemptDelivery(delivery) {
  if (delivery.status === "sent" || delivery.status === "failed") {
    return false;
  }
  const attempts = Number(delivery.attempts ?? 0);
  const maxAttempts = Number(delivery.maxAttempts ?? MAX_EMAIL_ATTEMPTS);
  if (attempts >= maxAttempts) {
    return false;
  }
  const nextAttemptAt = delivery.nextAttemptAt ? Date.parse(delivery.nextAttemptAt) : 0;
  if (Number.isFinite(nextAttemptAt) && nextAttemptAt > Date.now()) {
    return false;
  }
  if (delivery.status === "sending") {
    const lastAttemptAt = delivery.lastAttemptAt ? Date.parse(delivery.lastAttemptAt) : 0;
    if (Number.isFinite(lastAttemptAt) && Date.now() - lastAttemptAt < STALE_SENDING_WINDOW_MS) {
      return false;
    }
  }
  return true;
}

async function markEmailAttemptStarted(databases, delivery) {
  const attempts = Number(delivery.attempts ?? 0) + 1;
  const now = new Date().toISOString();
  return databases.updateDocument(DATABASE_ID, Collections.EMAIL_DELIVERIES, delivery.$id, {
    status: "sending",
    attempts,
    lastAttemptAt: now,
    updatedAt: now,
  });
}

async function handleEmailFailure(databases, delivery, error) {
  const attempts = Number(delivery.attempts ?? 0);
  const maxAttempts = Number(delivery.maxAttempts ?? MAX_EMAIL_ATTEMPTS);
  const message = toErrorMessage(error);
  const retriable = isRetriableError(error);
  const canRetry = retriable && attempts < maxAttempts;
  const now = new Date().toISOString();

  if (!canRetry) {
    const failed = await databases.updateDocument(DATABASE_ID, Collections.EMAIL_DELIVERIES, delivery.$id, {
      status: "failed",
      nextAttemptAt: null,
      lastError: message,
      updatedAt: now,
    });
    return { delivery: failed, shouldRetryNow: false, delayMs: 0 };
  }

  const delayMs = getRetryDelayMs(attempts);
  const nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
  const retrying = await databases.updateDocument(DATABASE_ID, Collections.EMAIL_DELIVERIES, delivery.$id, {
    status: "retrying",
    nextAttemptAt,
    lastError: message,
    updatedAt: now,
  });

  return {
    delivery: retrying,
    shouldRetryNow: attempts < Math.min(maxAttempts, MAX_IMMEDIATE_RETRIES_PER_EXECUTION),
    delayMs,
  };
}

function getRetryDelayMs(attemptNumber) {
  const baseDelay = 30_000;
  const maxDelay = 15 * 60 * 1000;
  return Math.min(baseDelay * 2 ** Math.max(attemptNumber - 1, 0), maxDelay);
}

function buildDedupeKey(event, userId, channel) {
  return createHash("sha256").update(JSON.stringify({
    channel,
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
  if (EMAIL_AUTOMATION_PROVIDER === "google_apps_script") {
    if (!GOOGLE_APPS_SCRIPT_WEB_APP_URL || !GOOGLE_APPS_SCRIPT_AUTH_TOKEN) {
      throw new Error("Google Apps Script email automation is configured but credentials are missing.");
    }
    return {
      provider: "google_apps_script",
      async send(message) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        try {
          const response = await fetch(GOOGLE_APPS_SCRIPT_WEB_APP_URL, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-automation-token": GOOGLE_APPS_SCRIPT_AUTH_TOKEN,
            },
            body: JSON.stringify({
              to: message.to,
              subject: message.subject,
              title: message.title,
              body: message.body,
              text: message.text,
              html: message.html,
              metadata: message.metadata,
            }),
            signal: controller.signal,
          });
          const raw = await safeReadJson(response);
          if (!response.ok || raw?.ok === false) {
            const providerError = new Error(raw?.error || `Google Apps Script returned ${response.status}.`);
            providerError.status = response.status;
            throw providerError;
          }
          return {
            messageId: raw?.messageId ? String(raw.messageId) : undefined,
            raw,
          };
        } finally {
          clearTimeout(timeout);
        }
      },
    };
  }

  return {
    provider: "log",
    async send(message) {
      console.log("[notification-email]", JSON.stringify(message));
      return {
        messageId: `log-${message.metadata?.dedupeKey ?? Date.now()}`,
        raw: { ok: true, provider: "log" },
      };
    },
  };
}

function buildTextEmailBody(delivery) {
  return `${delivery.title}\n\n${delivery.body}`;
}

function buildHtmlEmailBody(delivery) {
  const title = escapeHtml(String(delivery.title));
  const body = escapeHtml(String(delivery.body)).replaceAll("\n", "<br />");
  return `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; color: #111827;"><h2>${title}</h2><p>${body}</p></body></html>`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function safeReadJson(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function extractSignedPayload(body) {
  const payload = { ...body };
  delete payload.issuedAt;
  delete payload.nonce;
  delete payload.signature;
  return payload;
}

function createSignature({ payload, issuedAt, nonce, secret }) {
  const hmac = createHmac("sha256", secret);
  hmac.update(issuedAt);
  hmac.update(":");
  hmac.update(nonce);
  hmac.update(":");
  hmac.update(JSON.stringify(payload ?? null));
  return hmac.digest("hex");
}

function verifySignedPayload(body, secret) {
  if (
    typeof body.issuedAt !== "string" ||
    typeof body.nonce !== "string" ||
    typeof body.signature !== "string"
  ) {
    return { ok: false, reason: "Missing execution signature." };
  }

  const issuedAtMs = Date.parse(body.issuedAt);
  if (Number.isNaN(issuedAtMs)) {
    return { ok: false, reason: "Invalid execution timestamp." };
  }

  if (Math.abs(Date.now() - issuedAtMs) > SIGNATURE_MAX_AGE_SECONDS * 1000) {
    return { ok: false, reason: "Execution signature expired." };
  }

  const expected = createSignature({
    payload: extractSignedPayload(body),
    issuedAt: body.issuedAt,
    nonce: body.nonce,
    secret,
  });
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(body.signature, "utf8");
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return { ok: false, reason: "Invalid execution signature." };
  }

  return { ok: true };
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Email delivery failed.";
}

function isRetriableError(error) {
  if (error?.name === "AbortError") {
    return true;
  }
  const status = Number(error?.status ?? error?.code ?? 0);
  return !status || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function isConflictError(error) {
  return typeof error === "object" && error !== null && Number(error.code) === 409;
}
