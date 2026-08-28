/**
 * Browser-side Appwrite client.
 * Uses only the public project endpoint and project ID — never a server API key.
 * Safe to import in Client Components and hooks.
 *
 * Validation of required environment variables happens at client-construction
 * time via getPublicEnv(), providing a clear error instead of a silent failure.
 */
import { Client, Account, Databases, Storage } from "appwrite";
import { getPublicEnv } from "@/lib/validation/env";

function createBrowserClient(): Client {
  const env = getPublicEnv();
  const client = new Client();
  client
    .setEndpoint(env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);
  return client;
}

// Singleton instances for browser use
let browserClient: Client | null = null;

export function getBrowserClient(): Client {
  if (!browserClient) {
    browserClient = createBrowserClient();
  }
  return browserClient;
}

export function getBrowserAccount(): Account {
  return new Account(getBrowserClient());
}

export function getBrowserDatabases(): Databases {
  return new Databases(getBrowserClient());
}

export function getBrowserStorage(): Storage {
  return new Storage(getBrowserClient());
}
