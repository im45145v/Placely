/**
 * Browser-side Appwrite client.
 * Uses only the public project endpoint and project ID — never a server API key.
 * Safe to import in Client Components and hooks.
 */
import { Client, Account, Databases, Storage } from "appwrite";
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "./constants";

function createBrowserClient(): Client {
  const client = new Client();
  client.setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
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
