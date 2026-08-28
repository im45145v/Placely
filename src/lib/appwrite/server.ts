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
import { getServerEnv } from "@/lib/validation/env";

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
    databases: new Databases(client),
    storage: new Storage(client),
    users: new Users(client),
    functions: new Functions(client),
  };
}

// Convenience single-service helpers for cases where only one service is needed.
export function getServerDatabases(client?: Client): Databases {
  return new Databases(client ?? createServerClient());
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
