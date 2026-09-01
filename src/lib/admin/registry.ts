import { Collections } from "@/lib/appwrite/constants";

export interface AdminSectionConfig {
  slug: string;
  label: string;
  description: string;
  collectionId?: string;
  defaultSort?: string;
  defaultDirection?: "asc" | "desc";
  filterFields?: Array<{
    key: string;
    label: string;
    options: string[];
  }>;
  searchableFields?: string[];
  columns?: string[];
}

export const ADMIN_SECTIONS: AdminSectionConfig[] = [
  {
    slug: "dashboard",
    label: "Dashboard",
    description: "Operations overview, platform health, and fast access to the most active admin workflows.",
  },
  {
    slug: "students",
    label: "Students",
    description: "Directory of student users and profile completion, placement, and graduation metadata.",
    collectionId: Collections.STUDENT_PROFILES,
    defaultSort: "updatedAt",
    defaultDirection: "desc",
    filterFields: [
      { key: "isProfileComplete", label: "Profile", options: ["true", "false"] },
      { key: "placement.status", label: "Placement", options: ["NOT_PLACED", "PLACED", "OPTED_OUT"] },
      { key: "academic.graduationYear", label: "Graduation Year", options: ["2024", "2025", "2026", "2027", "2028"] },
    ],
    searchableFields: ["userId", "academic.ugDegree", "academic.ugBranch", "professional.skills", "placement.status"],
    columns: ["userId", "academic.ugDegree", "academic.ugBranch", "academic.graduationYear", "placement.status", "isProfileComplete", "updatedAt"],
  },
  {
    slug: "companies",
    label: "Companies",
    description: "Company master data, status, contacts, locations, and logo-backed profiles.",
  },
  {
    slug: "roles",
    label: "Roles",
    description: "Open roles, compensation, openings, deadlines, and publication state.",
  },
  {
    slug: "applications",
    label: "Applications",
    description: "Application queue, shortlisting, round workflow, and export/import operations.",
  },
  {
    slug: "shortlists",
    label: "Shortlists",
    description: "Bulk shortlist operations and shortlisted application records for operational tracking.",
    collectionId: Collections.BULK_OPERATIONS,
    defaultSort: "createdAt",
    defaultDirection: "desc",
    filterFields: [
      { key: "action", label: "Action", options: ["bulk_shortlist", "auto_shortlist"] },
      { key: "status", label: "Status", options: ["queued", "running", "completed", "failed"] },
    ],
    searchableFields: ["action", "status", "actorId", "summary"],
    columns: ["action", "status", "targetCount", "successCount", "failureCount", "actorId", "createdAt"],
  },
  {
    slug: "rounds",
    label: "Rounds",
    description: "Interview and assessment rounds with sequencing, schedule, and status controls.",
    collectionId: Collections.PLACEMENT_ROUNDS,
    defaultSort: "updatedAt",
    defaultDirection: "desc",
    filterFields: [
      { key: "status", label: "Status", options: ["scheduled", "active", "completed", "cancelled"] },
      { key: "type", label: "Type", options: ["resume_shortlist", "online_assessment", "technical_interview", "managerial_interview", "hr_interview", "group_discussion", "other"] },
    ],
    searchableFields: ["name", "type", "location", "status"],
    columns: ["name", "type", "status", "sequence", "startTime", "endTime", "location"],
  },
  {
    slug: "results",
    label: "Results",
    description: "Round outcomes, scores, feedback, and result publication timestamps.",
    collectionId: Collections.RESULTS,
    defaultSort: "updatedAt",
    defaultDirection: "desc",
    filterFields: [
      { key: "outcome", label: "Outcome", options: ["PASSED", "FAILED", "WAITLISTED", "SELECTED"] },
    ],
    searchableFields: ["applicationId", "studentId", "outcome", "feedback"],
    columns: ["applicationId", "studentId", "outcome", "score", "publishedAt", "updatedAt"],
  },
  {
    slug: "eligibility",
    label: "Eligibility",
    description: "Eligibility rule sets attached to roles and used by application validation.",
    collectionId: Collections.ELIGIBILITY_RULES,
    defaultSort: "updatedAt",
    defaultDirection: "desc",
    searchableFields: ["name", "description", "roleId", "createdBy"],
    columns: ["name", "roleId", "createdBy", "createdAt", "updatedAt"],
  },
  {
    slug: "variables",
    label: "Variables",
    description: "Built-in and custom variables used across eligibility, analytics, and notifications.",
  },
  {
    slug: "notifications",
    label: "Notifications",
    description: "Operational view of student notifications and delivery payloads.",
    collectionId: Collections.NOTIFICATIONS,
    defaultSort: "createdAt",
    defaultDirection: "desc",
    filterFields: [
      { key: "type", label: "Type", options: ["COMPANY_PUBLISHED", "APPLICATION_SUBMITTED", "SHORTLISTED", "ROUND_SCHEDULED", "ROUND_UPDATED", "RESULT_PUBLISHED", "DEADLINE_REMINDER", "ANNOUNCEMENT"] },
      { key: "isRead", label: "Read", options: ["true", "false"] },
    ],
    searchableFields: ["title", "body", "type", "templateKey", "userId"],
    columns: ["type", "title", "userId", "isRead", "createdAt", "updatedAt"],
  },
  {
    slug: "announcements",
    label: "Announcements",
    description: "Published student communications, priority flagging, and expiry tracking.",
    collectionId: Collections.ANNOUNCEMENTS,
    defaultSort: "publishedAt",
    defaultDirection: "desc",
    filterFields: [
      { key: "isImportant", label: "Priority", options: ["true", "false"] },
    ],
    searchableFields: ["title", "body"],
    columns: ["title", "isImportant", "publishedAt", "expiresAt", "updatedAt"],
  },
  {
    slug: "analytics",
    label: "Analytics",
    description: "Placement funnel and cohort analytics with server-side filtering and export.",
  },
  {
    slug: "import-export",
    label: "Import Export",
    description: "Validated CSV and Excel-friendly TSV imports with preview/confirm processing plus data exports.",
  },
  {
    slug: "reports",
    label: "Reports",
    description: "Generated admin exports and operational batch history.",
    collectionId: Collections.BULK_OPERATIONS,
    defaultSort: "createdAt",
    defaultDirection: "desc",
    filterFields: [
      { key: "action", label: "Action", options: ["csv_import", "csv_export", "bulk_shortlist", "auto_shortlist", "bulk_reject", "bulk_move_to_round"] },
      { key: "status", label: "Status", options: ["queued", "running", "completed", "failed"] },
    ],
    searchableFields: ["action", "status", "actorId", "errorMessage"],
    columns: ["action", "status", "targetCount", "processedCount", "errorMessage", "createdAt", "completedAt"],
  },
  {
    slug: "documents",
    label: "Documents",
    description: "Resume, JD, logo, and other stored document metadata by entity and owner.",
    collectionId: "document_metadata",
    defaultSort: "updatedAt",
    defaultDirection: "desc",
    filterFields: [
      { key: "entityType", label: "Entity", options: ["resume", "company_logo", "role_jd"] },
      { key: "isPrivate", label: "Visibility", options: ["true", "false"] },
    ],
    searchableFields: ["entityType", "entityId", "fileName", "mimeType", "ownerUserId"],
    columns: ["entityType", "entityId", "fileName", "mimeType", "fileSize", "ownerUserId", "updatedAt"],
  },
  {
    slug: "audit-logs",
    label: "Audit Logs",
    description: "Append-only history of admin actions across records and workflows.",
    collectionId: Collections.AUDIT_LOGS,
    defaultSort: "timestamp",
    defaultDirection: "desc",
    filterFields: [
      { key: "actorRole", label: "Actor Role", options: ["PLACEMENT_ADMIN", "SUPER_ADMIN"] },
    ],
    searchableFields: ["action", "entityType", "entityId", "actorId", "actorName", "actorEmail", "userAgent"],
    columns: ["action", "entityType", "entityId", "actorName", "actorEmail", "actorRole", "timestamp"],
  },
  {
    slug: "settings",
    label: "Settings",
    description: "University-scoped operational settings and platform configuration records.",
    collectionId: Collections.SETTINGS,
    defaultSort: "updatedAt",
    defaultDirection: "desc",
    searchableFields: ["key", "label", "description", "value"],
    columns: ["key", "label", "updatedAt", "$id"],
  },
];

export const ADMIN_NAV = ADMIN_SECTIONS.map(({ label, slug }) => ({
  label,
  href: `/admin/${slug}`,
}));

export function getAdminSection(slug: string): AdminSectionConfig | undefined {
  return ADMIN_SECTIONS.find((section) => section.slug === slug);
}
