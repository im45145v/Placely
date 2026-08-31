import { Client, Databases, Functions, ID, Query } from "node-appwrite";

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;
const ENDPOINT = process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const NOTIFICATION_FUNCTION_ID = process.env.APPWRITE_NOTIFICATION_FUNCTION_ID;

const Collections = {
  APPLICATIONS: "applications",
  PLACEMENT_ROUNDS: "placement_rounds",
  ROUND_PARTICIPANTS: "round_participants",
  AUDIT_LOGS: "audit_logs",
  BULK_OPERATIONS: "bulk_operations",
  STUDENT_PROFILES: "student_profiles",
  USERS: "users",
  COMPANIES: "companies",
  ROLES: "roles",
};

export default async function main({ req, res }) {
  if (!DATABASE_ID || !API_KEY || !PROJECT_ID) {
    return res.json({ ok: false, error: "Missing function environment variables." }, 500);
  }

  const body = safeJsonParse(req.body ?? "{}");
  const operationId = typeof body.operationId === "string" ? body.operationId : "";
  if (!operationId) {
    return res.json({ ok: false, error: "operationId is required." }, 400);
  }

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);
  const notificationClient = NOTIFICATION_FUNCTION_ID
    ? new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY)
    : null;
  const notificationFunctions = notificationClient ? new Functions(notificationClient) : null;
  const operation = await databases.getDocument(DATABASE_ID, Collections.BULK_OPERATIONS, operationId);

  await databases.updateDocument(DATABASE_ID, Collections.BULK_OPERATIONS, operationId, {
    status: "running",
    updatedAt: new Date().toISOString(),
  });

  const input = operation.input ?? {};
  const applicationIds = Array.isArray(input.applicationIds) ? input.applicationIds.map(String).filter(Boolean) : [];
  const rows = Array.isArray(input.rows) ? input.rows : [];
  let successCount = 0;
  let failureCount = 0;

  try {
    if (operation.action === "csv_import") {
      for (const row of rows) {
        try {
          await executeRow(databases, notificationFunctions, row);
          successCount += 1;
        } catch {
          failureCount += 1;
        }
      }
    } else {
      for (const applicationId of applicationIds) {
        try {
          await executeApplicationAction(databases, notificationFunctions, operation, applicationId, input);
          successCount += 1;
        } catch {
          failureCount += 1;
        }
      }
    }

    const completedAt = new Date().toISOString();
    await databases.updateDocument(DATABASE_ID, Collections.BULK_OPERATIONS, operationId, {
      status: failureCount > 0 && successCount === 0 ? "failed" : "completed",
      processedCount: successCount + failureCount,
      successCount,
      failureCount,
      summary: { applicationIds, rowsProcessed: rows.length || undefined },
      updatedAt: completedAt,
      completedAt,
    });

    await createAuditLog(databases, operation, operationId, {
      action: `bulk_operation.${operation.action}`,
      newValue: { successCount, failureCount },
    });

    return res.json({ ok: true, operationId, successCount, failureCount });
  } catch (error) {
    const completedAt = new Date().toISOString();
    await databases.updateDocument(DATABASE_ID, Collections.BULK_OPERATIONS, operationId, {
      status: "failed",
      processedCount: successCount + failureCount,
      successCount,
      failureCount,
      errorMessage: error instanceof Error ? error.message : "Unexpected failure.",
      updatedAt: completedAt,
      completedAt,
    });
    return res.json({ ok: false, operationId, error: error instanceof Error ? error.message : "Unexpected failure." }, 500);
  }
}

async function executeRow(databases, notificationFunctions, row) {
  const action = typeof row.action === "string" ? row.action : "";
  if (action === "shortlist") {
    return updateApplication(databases, notificationFunctions, row.applicationId, { status: "SHORTLISTED", notes: row.notes ?? null }, "application.shortlisted");
  }
  if (action === "reject") {
    return updateApplication(databases, notificationFunctions, row.applicationId, { status: "REJECTED", notes: row.notes ?? null }, "application.rejected");
  }
  if (action === "move_to_round") {
    return moveToRound(databases, notificationFunctions, row.applicationId, row.roundId, row.notes ?? null);
  }
  throw new Error("Unsupported CSV action.");
}

async function executeApplicationAction(databases, notificationFunctions, operation, applicationId, input) {
  if (operation.action === "bulk_shortlist" || operation.action === "auto_shortlist") {
    return updateApplication(databases, notificationFunctions, applicationId, { status: "SHORTLISTED", notes: input.notes ?? null }, "application.shortlisted");
  }
  if (operation.action === "bulk_reject") {
    return updateApplication(databases, notificationFunctions, applicationId, { status: "REJECTED", notes: input.notes ?? null }, "application.rejected");
  }
  if (operation.action === "bulk_move_to_round") {
    return moveToRound(databases, notificationFunctions, applicationId, input.roundId, input.notes ?? null);
  }
  throw new Error("Unsupported bulk action.");
}

async function moveToRound(databases, notificationFunctions, applicationId, roundId, notes) {
  if (!roundId) {
    throw new Error("roundId is required.");
  }

  const application = await databases.getDocument(DATABASE_ID, Collections.APPLICATIONS, applicationId);
  const round = await databases.getDocument(DATABASE_ID, Collections.PLACEMENT_ROUNDS, roundId);
  if (String(round.roleId) !== String(application.roleId)) {
    throw new Error("Round does not belong to this role.");
  }

  const existing = await databases.listDocuments(DATABASE_ID, Collections.ROUND_PARTICIPANTS, [
    Query.equal("roundId", roundId),
    Query.equal("applicationId", applicationId),
    Query.limit(1),
  ]);

  if (!existing.documents[0]) {
    const now = new Date().toISOString();
    await databases.createDocument(DATABASE_ID, Collections.ROUND_PARTICIPANTS, ID.unique(), {
      roundId,
      applicationId,
      studentId: application.studentId,
      score: null,
      passed: null,
      notes: null,
      resultPublished: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  const updated = await updateApplication(databases, notificationFunctions, applicationId, { status: "IN_ROUND", currentRoundId: roundId, notes }, "application.moved_to_round");
  await dispatchRoundNotification(databases, notificationFunctions, updated, round, `bulk-round-scheduled:${roundId}:${applicationId}:${updated.lastStatusChangedAt}`);
  return updated;
}

async function updateApplication(databases, notificationFunctions, applicationId, patch, auditAction) {
  const existing = await databases.getDocument(DATABASE_ID, Collections.APPLICATIONS, applicationId);
  const now = new Date().toISOString();
  const updated = await databases.updateDocument(DATABASE_ID, Collections.APPLICATIONS, applicationId, {
    ...patch,
    lastStatusChangedAt: now,
    updatedAt: now,
  });

  await createAuditLog(databases, existing, applicationId, {
    action: auditAction,
    previousValue: {
      status: existing.status,
      currentRoundId: existing.currentRoundId ?? null,
      notes: existing.notes ?? null,
    },
    newValue: {
      ...patch,
    },
  });

  if (patch.status === "SHORTLISTED") {
    await dispatchShortlistNotification(databases, notificationFunctions, updated, `bulk-shortlisted:${applicationId}:${now}`);
  }

  return updated;
}

async function dispatchShortlistNotification(databases, notificationFunctions, application, dedupeKey) {
  if (!notificationFunctions) {
    return;
  }
  const role = await databases.getDocument(DATABASE_ID, Collections.ROLES, String(application.roleId));
  const company = await databases.getDocument(DATABASE_ID, Collections.COMPANIES, String(application.companyId));
  const studentProfile = await databases.getDocument(DATABASE_ID, Collections.STUDENT_PROFILES, String(application.studentId));
  const studentUser = await databases.getDocument(DATABASE_ID, Collections.USERS, String(studentProfile.userId));

  await notificationFunctions.createExecution(NOTIFICATION_FUNCTION_ID, JSON.stringify({
    type: "SHORTLISTED",
    universityId: String(application.universityId),
    recipientUserIds: [String(studentUser.$id)],
    entityId: String(application.$id),
    entityType: "application",
    dedupeKey,
    variables: {
      student_name: String(studentUser.name ?? "Student"),
      company_name: String(company.name ?? "Company"),
      role_name: String(role.title ?? "Role"),
    },
  }), true);
}

async function dispatchRoundNotification(databases, notificationFunctions, application, round, dedupeKey) {
  if (!notificationFunctions) {
    return;
  }
  const role = await databases.getDocument(DATABASE_ID, Collections.ROLES, String(application.roleId));
  const company = await databases.getDocument(DATABASE_ID, Collections.COMPANIES, String(application.companyId));
  const studentProfile = await databases.getDocument(DATABASE_ID, Collections.STUDENT_PROFILES, String(application.studentId));
  const studentUser = await databases.getDocument(DATABASE_ID, Collections.USERS, String(studentProfile.userId));

  await notificationFunctions.createExecution(NOTIFICATION_FUNCTION_ID, JSON.stringify({
    type: "ROUND_SCHEDULED",
    universityId: String(application.universityId),
    recipientUserIds: [String(studentUser.$id)],
    entityId: String(round.$id),
    entityType: "placement_round",
    dedupeKey,
    variables: {
      student_name: String(studentUser.name ?? "Student"),
      company_name: String(company.name ?? "Company"),
      role_name: String(role.title ?? "Role"),
      round_name: String(round.name ?? "Current round"),
    },
  }), true);
}

async function createAuditLog(databases, source, entityId, payload) {
  await databases.createDocument(DATABASE_ID, Collections.AUDIT_LOGS, ID.unique(), {
    universityId: String(source.universityId),
    actorId: String(source.actorId ?? "system"),
    actorRole: String(source.actorRole ?? "PLACEMENT_ADMIN"),
    action: payload.action,
    entityType: source.$id === entityId ? "application" : "bulk_operation",
    entityId,
    previousValue: payload.previousValue ?? null,
    newValue: payload.newValue ?? null,
    ipAddress: null,
    userAgent: "appwrite-function",
    timestamp: new Date().toISOString(),
  });
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
