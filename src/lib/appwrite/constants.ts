/**
 * Appwrite resource IDs used throughout the application.
 * All IDs are read from environment variables validated at startup.
 */

export const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";

export const APPWRITE_PROJECT_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";

// Database
export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID ?? "";

// Collections
export const Collections = {
  UNIVERSITIES: "universities",
  USERS: "users",
  STUDENT_PROFILES: "student_profiles",
  COMPANIES: "companies",
  ROLES: "roles",
  ELIGIBILITY_RULES: "eligibility_rules",
  VARIABLES: "variables",
  APPLICATIONS: "applications",
  PLACEMENT_ROUNDS: "placement_rounds",
  ROUND_PARTICIPANTS: "round_participants",
  RESULTS: "results",
  RESUMES: "resumes",
  NOTIFICATIONS: "notifications",
  NOTIFICATION_TEMPLATES: "notification_templates",
  ANNOUNCEMENTS: "announcements",
  AUDIT_LOGS: "audit_logs",
  PLACEMENT_RULES: "placement_rules",
  OFFERS: "offers",
  SETTINGS: "settings",
} as const;

export type CollectionId = (typeof Collections)[keyof typeof Collections];

// Storage buckets
export const Buckets = {
  RESUMES: "resumes",
  COMPANY_LOGOS: "company_logos",
  JD_ATTACHMENTS: "jd_attachments",
  IMPORT_FILES: "import_files",
} as const;

export type BucketId = (typeof Buckets)[keyof typeof Buckets];
