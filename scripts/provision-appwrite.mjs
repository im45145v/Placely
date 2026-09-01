import { Client, Databases, Storage } from "node-appwrite";

const schema = {
  databaseId: process.env.APPWRITE_DATABASE_ID || "placely-db",
  collections: [
    { id: "universities", name: "University" },
    { id: "users", name: "User" },
    { id: "student_profiles", name: "StudentProfile" },
    { id: "resumes", name: "Resume" },
    { id: "companies", name: "Company" },
    { id: "roles", name: "Role" },
    { id: "eligibility_rules", name: "EligibilityRule" },
    { id: "variables", name: "CustomVariable" },
    { id: "applications", name: "Application" },
    { id: "placement_rounds", name: "PlacementRound" },
    { id: "round_participants", name: "RoundParticipant" },
    { id: "results", name: "RoundResult" },
    { id: "notifications", name: "Notification" },
    { id: "email_deliveries", name: "EmailDelivery" },
    { id: "notification_templates", name: "NotificationTemplate" },
    { id: "document_metadata", name: "DocumentMetadata" },
    { id: "audit_logs", name: "AuditLog" },
    { id: "placement_rules", name: "PlacementRule" },
  ],
};

for (const key of [
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
]) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);
const buckets = [
  {
    id: "resumes",
    name: "Resumes",
    permissions: [],
    fileSecurity: true,
    enabled: true,
    maximumFileSize: 5 * 1024 * 1024,
    allowedFileExtensions: ["pdf", "doc", "docx"],
    compression: "none",
    encryption: true,
    antivirus: true,
  },
  {
    id: "company_logos",
    name: "Company Logos",
    permissions: [],
    fileSecurity: true,
    enabled: true,
    maximumFileSize: 2 * 1024 * 1024,
    allowedFileExtensions: ["png", "jpg", "jpeg", "webp", "svg"],
    compression: "none",
    encryption: true,
    antivirus: true,
  },
  {
    id: "jd_attachments",
    name: "JD Attachments",
    permissions: [],
    fileSecurity: true,
    enabled: true,
    maximumFileSize: 5 * 1024 * 1024,
    allowedFileExtensions: ["pdf", "doc", "docx"],
    compression: "none",
    encryption: true,
    antivirus: true,
  },
];

async function ensureDatabase() {
  try {
    await databases.get(schema.databaseId);
  } catch {
    await databases.create(schema.databaseId, "Placely");
  }
}

async function ensureCollection(id, name) {
  try {
    const existing = await databases.getCollection(schema.databaseId, id);
    if (!existing.documentSecurity || (existing.permissions ?? []).length > 0) {
      await databases.updateCollection(schema.databaseId, id, name, [], true, true);
    }
  } catch {
    await databases.createCollection(schema.databaseId, id, name, [], true, true);
  }
}

async function ensureBucket(bucket) {
  try {
    await storage.getBucket(bucket.id);
  } catch {
    await storage.createBucket(
      bucket.id,
      bucket.name,
      bucket.permissions,
      bucket.fileSecurity,
      bucket.enabled,
      bucket.maximumFileSize,
      bucket.allowedFileExtensions,
      bucket.compression,
      bucket.encryption,
      bucket.antivirus
    );
  }
}

async function main() {
  await ensureDatabase();

  for (const collection of schema.collections) {
    await ensureCollection(collection.id, collection.name);
  }

  for (const bucket of buckets) {
    await ensureBucket(bucket);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
