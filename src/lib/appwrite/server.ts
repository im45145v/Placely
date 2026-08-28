/**
 * Server-side Appwrite client.
 * Uses the server API key which is NEVER exposed to the browser.
 * Import ONLY in Server Components, Server Actions, Route Handlers, and Appwrite Functions.
 * Never import this file in Client Components.
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

export function getServerDatabases(): Databases {
  return new Databases(createServerClient());
}

export function getServerStorage(): Storage {
  return new Storage(createServerClient());
}

export function getServerUsers(): Users {
  return new Users(createServerClient());
}

export function getServerFunctions(): Functions {
  return new Functions(createServerClient());
}
