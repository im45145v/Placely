/**
 * Environment variable validation.
 *
 * - Public variables (NEXT_PUBLIC_*) are validated at module load time.
 * - Server-only variables are validated in getServerEnv(), which is called
 *   only on the server. This prevents accidental exposure to the browser bundle.
 */

/** Public environment variables — available on both client and server. */
export interface PublicEnv {
  NEXT_PUBLIC_APPWRITE_ENDPOINT: string;
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: string;
  NEXT_PUBLIC_APP_URL: string;
}

/** Server-only environment variables — never sent to the browser. */
export interface ServerEnv {
  APPWRITE_API_KEY: string;
  APPWRITE_DATABASE_ID: string;
  APPWRITE_SHORTLISTING_FUNCTION_ID?: string;
  APPWRITE_NOTIFICATION_FUNCTION_ID?: string;
  APPWRITE_FUNCTION_SHARED_SECRET?: string;
  APPWRITE_BOOTSTRAP_SUPER_ADMIN_EMAILS?: string[];
  EMAIL_AUTOMATION_PROVIDER?: "google_apps_script" | "log";
  GOOGLE_APPS_SCRIPT_WEB_APP_URL?: string;
  GOOGLE_APPS_SCRIPT_AUTH_TOKEN?: string;
}

function assertEnvVar(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Please copy .env.example to .env.local and fill in the required values.`
    );
  }
  return value.trim();
}

/**
 * Returns validated public environment variables.
 * Safe to call from both client and server code.
 */
export function getPublicEnv(): PublicEnv {
  return {
    NEXT_PUBLIC_APPWRITE_ENDPOINT: assertEnvVar(
      "NEXT_PUBLIC_APPWRITE_ENDPOINT",
      process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
    ),
    NEXT_PUBLIC_APPWRITE_PROJECT_ID: assertEnvVar(
      "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
      process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
    ),
    NEXT_PUBLIC_APP_URL: assertEnvVar(
      "NEXT_PUBLIC_APP_URL",
      process.env.NEXT_PUBLIC_APP_URL
    ),
  };
}

/**
 * Returns validated server-only environment variables.
 * Must only be called on the server (Server Components, Server Actions, Route Handlers).
 * Throws at runtime if called in a browser context or if variables are missing.
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "getServerEnv() must not be called in the browser. " +
        "This would expose secret API keys."
    );
  }

  return {
    APPWRITE_API_KEY: assertEnvVar(
      "APPWRITE_API_KEY",
      process.env.APPWRITE_API_KEY
    ),
    APPWRITE_DATABASE_ID: assertEnvVar(
      "APPWRITE_DATABASE_ID",
      process.env.APPWRITE_DATABASE_ID
    ),
    APPWRITE_SHORTLISTING_FUNCTION_ID: process.env.APPWRITE_SHORTLISTING_FUNCTION_ID?.trim() || undefined,
    APPWRITE_NOTIFICATION_FUNCTION_ID: process.env.APPWRITE_NOTIFICATION_FUNCTION_ID?.trim() || undefined,
    APPWRITE_FUNCTION_SHARED_SECRET: process.env.APPWRITE_FUNCTION_SHARED_SECRET?.trim() || undefined,
    APPWRITE_BOOTSTRAP_SUPER_ADMIN_EMAILS: normalizeOptionalEmailList(
      process.env.APPWRITE_BOOTSTRAP_SUPER_ADMIN_EMAILS
    ),
    EMAIL_AUTOMATION_PROVIDER: normalizeOptionalProvider(process.env.EMAIL_AUTOMATION_PROVIDER),
    GOOGLE_APPS_SCRIPT_WEB_APP_URL: process.env.GOOGLE_APPS_SCRIPT_WEB_APP_URL?.trim() || undefined,
    GOOGLE_APPS_SCRIPT_AUTH_TOKEN: process.env.GOOGLE_APPS_SCRIPT_AUTH_TOKEN?.trim() || undefined,
  };
}

function normalizeOptionalProvider(value: string | undefined): "google_apps_script" | "log" | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "google_apps_script" || normalized === "log") {
    return normalized;
  }
  throw new Error("EMAIL_AUTOMATION_PROVIDER must be one of: google_apps_script, log.");
}

function normalizeOptionalEmailList(value: string | undefined): string[] | undefined {
  const normalized = value
    ?.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!normalized || normalized.length === 0) {
    return undefined;
  }

  return Array.from(new Set(normalized));
}
