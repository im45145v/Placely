/**
 * Server-side Appwrite client.
 * Uses the server API key which is NEVER exposed to the browser.
 * Import ONLY in Server Components, Server Actions, Route Handlers, and Appwrite Functions.
 * Never import this file in Client Components.
 *
 * Use createServerClient() once per request/action, then pass it to the helper
 * functions below to avoid creating multiple Client instances for the same request.
 */
import { Client, Databases, Storage, Users, Functions } from "node-appwrite";
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "./constants";
import { APPWRITE_DATABASE_SCHEMA } from "./schema";
import { getServerEnv } from "@/lib/validation/env";

const STRUCTURED_FIELDS = new Map(
  APPWRITE_DATABASE_SCHEMA.collections.map((collection) => [
    collection.id,
    new Set(collection.fields.filter((field) => field.type === "json").map((field) => field.key)),
  ])
);

function encodeStructuredData(collectionId: string, data: Record<string, unknown>): Record<string, unknown> {
  const structuredFields = STRUCTURED_FIELDS.get(collectionId);
  if (!structuredFields) return data;

  return Object.fromEntries(Object.entries(data).map(([key, value]) => [
    key,
    structuredFields.has(key) && value !== null && typeof value !== "string"
      ? JSON.stringify(value)
      : value,
  ]));
}

function decodeStructuredDocument<T>(collectionId: string, document: T): T {
  if (!document || typeof document !== "object") return document;
  const structuredFields = STRUCTURED_FIELDS.get(collectionId);
  if (!structuredFields) return document;

  const result = { ...(document as Record<string, unknown>) };
  for (const key of structuredFields) {
    const value = result[key];
    if (typeof value !== "string") continue;
    try {
      result[key] = JSON.parse(value);
    } catch {
      // Preserve invalid historical values rather than turning a read into an outage.
    }
  }
  return result as T;
}

/**
 * Appwrite legacy Collections lack JSON attributes. This adapter keeps the
 * application model stable by serializing declared JSON fields as strings.
 */
function createDatabases(client: Client): Databases {
  const databases = new Databases(client);
  return new Proxy(databases, {
    get(target, property, receiver) {
      if (property === "createDocument" || property === "updateDocument") {
        return async (...args: unknown[]) => {
          const collectionId = String(args[1]);
          const dataIndex = 3;
          args[dataIndex] = encodeStructuredData(collectionId, args[dataIndex] as Record<string, unknown>);
          const result = await (target[property] as (...methodArgs: unknown[]) => Promise<unknown>)(...args);
          return decodeStructuredDocument(collectionId, result);
        };
      }
      if (property === "getDocument") {
        return async (...args: unknown[]) => {
          const result = await (target[property] as (...methodArgs: unknown[]) => Promise<unknown>)(...args);
          return decodeStructuredDocument(String(args[1]), result);
        };
      }
      if (property === "listDocuments") {
        return async (...args: unknown[]) => {
          const result = await (target[property] as (...methodArgs: unknown[]) => Promise<{ documents: unknown[] }>)(...args);
          return {
            ...result,
            documents: result.documents.map((document) => decodeStructuredDocument(String(args[1]), document)),
          };
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Databases;
}

export function createServerClient(): Client {
  const env = getServerEnv();
  const client = new Client();
  client
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(env.APPWRITE_API_KEY);
  return client;
}

/** All Appwrite server services bundled for a single request. */
export interface ServerServices {
  databases: Databases;
  storage: Storage;
  users: Users;
  functions: Functions;
}

/**
 * Creates all Appwrite server services from a single Client instance.
 * Use this when a server action or route handler needs more than one service
 * to avoid unnecessary client instantiation.
 *
 * @example
 * const { databases, storage } = createServerServices();
 */
export function createServerServices(
  client: Client = createServerClient()
): ServerServices {
  return {
    databases: createDatabases(client),
    storage: new Storage(client),
    users: new Users(client),
    functions: new Functions(client),
  };
}

// Convenience single-service helpers for cases where only one service is needed.
export function getServerDatabases(client?: Client): Databases {
  return createDatabases(client ?? createServerClient());
}

export function getServerStorage(client?: Client): Storage {
  return new Storage(client ?? createServerClient());
}

export function getServerUsers(client?: Client): Users {
  return new Users(client ?? createServerClient());
}

export function getServerFunctions(client?: Client): Functions {
  return new Functions(client ?? createServerClient());
}
