import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Client, Databases, Storage } from "node-appwrite";
import ts from "typescript";

const collections = {
  UNIVERSITIES: "universities", USERS: "users", STUDENT_PROFILES: "student_profiles",
  COMPANIES: "companies", ROLES: "roles", ELIGIBILITY_RULES: "eligibility_rules",
  VARIABLES: "variables", APPLICATIONS: "applications", PLACEMENT_ROUNDS: "placement_rounds",
  ROUND_PARTICIPANTS: "round_participants", RESULTS: "results", RESUMES: "resumes",
  NOTIFICATIONS: "notifications", EMAIL_DELIVERIES: "email_deliveries",
  NOTIFICATION_TEMPLATES: "notification_templates", ANNOUNCEMENTS: "announcements",
  AUDIT_LOGS: "audit_logs", BULK_OPERATIONS: "bulk_operations", PLACEMENT_RULES: "placement_rules",
};
const databaseId = process.env.APPWRITE_DATABASE_ID || "placely-db";
for (const key of ["NEXT_PUBLIC_APPWRITE_ENDPOINT", "NEXT_PUBLIC_APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"]) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const client = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);
const storage = new Storage(client);
const buckets = [
  ["resumes", "Resumes", 5 * 1024 * 1024, ["pdf", "doc", "docx"]],
  ["company_logos", "Company Logos", 2 * 1024 * 1024, ["png", "jpg", "jpeg", "webp", "svg"]],
  ["jd_attachments", "JD Attachments", 5 * 1024 * 1024, ["pdf", "doc", "docx"]],
];

async function loadSchema() {
  const source = await readFile(new URL("../src/lib/appwrite/schema.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source.replace(/^import .*?;\n/gm, ""), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", "Collections", "DATABASE_ID", output)(module.exports, module, collections, databaseId);
  return module.exports.APPWRITE_DATABASE_SCHEMA;
}

async function ensureDatabase() {
  try { await databases.get(databaseId); } catch { await databases.create(databaseId, "Placely"); }
}
async function ensureCollection(collection) {
  try { await databases.getCollection(databaseId, collection.id); } catch {
    await databases.createCollection(databaseId, collection.id, collection.entity, [], true, true);
  }
}
async function ensureBucket([id, name, maximumFileSize, allowedFileExtensions]) {
  try { await storage.getBucket(id); } catch {
    try {
      await storage.createBucket(id, name, [], true, true, maximumFileSize, allowedFileExtensions, "none", true, true);
    } catch (error) {
      if (error?.code === 401) {
        console.warn(`Skipping bucket ${id}: APPWRITE_API_KEY needs buckets.write to create missing buckets.`);
        return;
      }
      throw error;
    }
  }
}
async function waitForAttribute(collectionId, key) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const { attributes } = await databases.listAttributes(databaseId, collectionId);
    const attribute = attributes.find((item) => item.key === key);
    if (attribute?.status === "available") return;
    if (attribute?.status === "failed") throw new Error(`${collectionId}.${key}: ${attribute.error}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${collectionId}.${key}`);
}
async function createAttribute(collection, field) {
  // Legacy Appwrite Collections use strings for IDs, relationships, and JSON blobs.
  // Validation remains in the application; optional fields preserve existing documents.
  const required = false;
  const type = field.type === "relationship" ? "string" : field.type;
  const indexed = collection.indexes.some((index) => index.attributes.includes(field.key));
  if (type === "string" || type === "json" || type === "string[]") {
    await databases.createStringAttribute(databaseId, collection.id, field.key, indexed ? 128 : 65535, required, undefined, type === "string[]");
  } else if (type === "integer") await databases.createIntegerAttribute(databaseId, collection.id, field.key, required);
  else if (type === "double") await databases.createFloatAttribute(databaseId, collection.id, field.key, required);
  else if (type === "boolean") await databases.createBooleanAttribute(databaseId, collection.id, field.key, required);
  else if (type === "datetime") await databases.createDatetimeAttribute(databaseId, collection.id, field.key, required);
  else if (type === "enum") await databases.createEnumAttribute(databaseId, collection.id, field.key, [...field.enumValues], required);
  else throw new Error(`Unsupported field type ${field.type} for ${collection.id}.${field.key}`);
  await waitForAttribute(collection.id, field.key);
}
async function ensureCollectionSchema(collection) {
  const { attributes } = await databases.listAttributes(databaseId, collection.id);
  const knownAttributes = new Set(attributes.map((attribute) => attribute.key));
  for (const field of collection.fields) {
    if (!knownAttributes.has(field.key)) {
      console.log(`Creating attribute ${collection.id}.${field.key}`);
      await createAttribute(collection, field);
    }
  }
  // The first production run created a few indexed strings at the large
  // content size. Shrink those keys before creating their database indexes.
  for (const attribute of attributes) {
    const indexed = collection.indexes.some((index) => index.attributes.includes(attribute.key));
    if (indexed && attribute.type === "string" && attribute.size > 128) {
      console.log(`Resizing indexed attribute ${collection.id}.${attribute.key}`);
      await databases.updateStringAttribute(databaseId, collection.id, attribute.key, false, null, 128);
      await waitForAttribute(collection.id, attribute.key);
    }
  }
  const { attributes: refreshedAttributes } = await databases.listAttributes(databaseId, collection.id);
  const attributeByKey = new Map(refreshedAttributes.map((attribute) => [attribute.key, attribute]));
  const { indexes } = await databases.listIndexes(databaseId, collection.id);
  const knownIndexes = new Set(indexes.map((index) => index.key));
  for (const index of collection.indexes) {
    const indexKey = index.key.length <= 36
      ? index.key
      : `${index.key.slice(0, 27)}_${createHash("sha1").update(index.key).digest("hex").slice(0, 8)}`;
    if (!knownIndexes.has(indexKey)) {
      if (index.attributes.some((key) => attributeByKey.get(key)?.type === "text")) {
        console.warn(`Skipping incompatible index ${collection.id}.${indexKey}: legacy text attribute.`);
        continue;
      }
      console.log(`Creating index ${collection.id}.${indexKey}`);
      await databases.createIndex(databaseId, collection.id, indexKey, index.type, index.attributes);
    }
  }
}
async function main() {
  const schema = await loadSchema();
  await ensureDatabase();
  for (const collection of schema.collections) await ensureCollection(collection);
  for (const collection of schema.collections) await ensureCollectionSchema(collection);
  for (const bucket of buckets) await ensureBucket(bucket);
  console.log("Appwrite schema is provisioned.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
