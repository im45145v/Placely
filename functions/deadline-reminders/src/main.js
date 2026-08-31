import { Client, Databases, Functions, Query } from "node-appwrite";

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;
const ENDPOINT = process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const NOTIFICATION_FUNCTION_ID = process.env.APPWRITE_NOTIFICATION_FUNCTION_ID;

const Collections = {
  ROLES: "roles",
  USERS: "users",
  COMPANIES: "companies",
};

export default async function main({ res }) {
  if (!DATABASE_ID || !API_KEY || !PROJECT_ID || !NOTIFICATION_FUNCTION_ID) {
    return res.json({ ok: false, error: "Missing function environment variables." }, 500);
  }

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);
  const functions = new Functions(client);
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const roles = await databases.listDocuments(DATABASE_ID, Collections.ROLES, [
    Query.equal("status", "published"),
    Query.greaterThanEqual("applicationDeadline", now.toISOString()),
    Query.lessThanEqual("applicationDeadline", horizon),
    Query.limit(500),
  ]);

  let dispatched = 0;
  for (const role of roles.documents) {
    const company = await databases.getDocument(DATABASE_ID, Collections.COMPANIES, String(role.companyId));
    const students = await databases.listDocuments(DATABASE_ID, Collections.USERS, [
      Query.equal("universityId", String(role.universityId)),
      Query.equal("role", "STUDENT"),
      Query.equal("isActive", true),
      Query.limit(500),
    ]);

    await functions.createExecution(NOTIFICATION_FUNCTION_ID, JSON.stringify({
      type: "DEADLINE_REMINDER",
      universityId: String(role.universityId),
      recipientUserIds: students.documents.map((doc) => doc.$id),
      entityId: role.$id,
      entityType: "role",
      dedupeKey: `deadline-reminder:${role.$id}:${role.applicationDeadline?.slice(0, 10) ?? now.toISOString().slice(0, 10)}`,
      variables: {
        company_name: String(company.name ?? "Company"),
        role_name: String(role.title),
        deadline: String(role.applicationDeadline),
      },
    }), true);
    dispatched += 1;
  }

  return res.json({
    ok: true,
    scannedAt: now.toISOString(),
    reminderWindowEndsAt: horizon,
    rolesMatched: roles.documents.length,
    dispatches: dispatched,
  });
}
