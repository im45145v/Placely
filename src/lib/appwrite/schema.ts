import { Collections, DATABASE_ID } from "./constants";
import type { UserRole } from "@/types";

export type FieldType =
  | "string"
  | "integer"
  | "double"
  | "boolean"
  | "datetime"
  | "enum"
  | "relationship"
  | "json"
  | "string[]";

export interface SchemaField {
  key: string;
  type: FieldType;
  required: boolean;
  relationship?: {
    targetCollection: string;
    kind: "one-to-one" | "many-to-one" | "one-to-many";
  };
  enumValues?: readonly string[];
  validation: string;
}

export interface SchemaIndex {
  key: string;
  type: "key" | "unique" | "fulltext";
  attributes: string[];
  rationale: string;
}

export interface PermissionDecision {
  actor: "student_owner" | "placement_admin" | "super_admin" | "system";
  access: "read" | "create" | "update" | "delete";
  decision: string;
}

export interface CollectionSchema {
  id: string;
  entity: string;
  sensitive: boolean;
  fields: SchemaField[];
  indexes: SchemaIndex[];
  permissions: PermissionDecision[];
}

const roleEnum = ["STUDENT", "PLACEMENT_ADMIN", "SUPER_ADMIN"] as const satisfies readonly UserRole[];

export const APPWRITE_DATABASE_SCHEMA: {
  databaseId: string;
  collections: CollectionSchema[];
} = {
  databaseId: DATABASE_ID || "placely-db",
  collections: [
    collection(Collections.UNIVERSITIES, "University", false, [
      field("name", "string", true, "1-255 chars."),
      field("domain", "string", true, "Lowercase email domain; unique per university."),
      field("logoUrl", "string", false, "Optional logo URL."),
      field("isActive", "boolean", true, "Controls tenant access."),
      timestamp("createdAt"),
      timestamp("updatedAt"),
    ], [
      index("university_domain_unique", "unique", ["domain"], "Resolve university by email domain during first login."),
      index("university_active_name", "key", ["isActive", "name"], "List active universities efficiently."),
    ], [
      permit("student_owner", "read", "Authenticated users may read their own university metadata only."),
      permit("placement_admin", "read", "Placement admins may read their university metadata."),
      permit("placement_admin", "update", "Placement admins may update their university metadata."),
      permit("super_admin", "create", "Super admins create university tenants."),
      permit("super_admin", "update", "Super admins manage all universities."),
    ]),
    collection(Collections.USERS, "User", true, [
      field("name", "string", true, "1-255 chars."),
      field("email", "string", true, "Validated email address."),
      relation("universityId", Collections.UNIVERSITIES, "many-to-one", true, "Server-owned tenant reference."),
      field("role", "enum", true, "Server-assigned authorization role.", roleEnum),
      field("isActive", "boolean", true, "Inactive users cannot access protected routes."),
      field("onboardingCompletedAt", "datetime", false, "Set on first completed login."),
      timestamp("createdAt"),
      timestamp("updatedAt"),
    ], [
      index("user_email_unique", "unique", ["email"], "Prevent duplicate application records."),
      index("user_university_role", "key", ["universityId", "role"], "Role-based admin queries."),
      index("user_active_university", "key", ["isActive", "universityId"], "Filter active users by university."),
    ], [
      permit("student_owner", "read", "Students may read only their own user record."),
      permit("student_owner", "update", "Students may update only safe personal fields via server validation."),
      permit("placement_admin", "read", "Placement admins may read users in their university."),
      permit("placement_admin", "update", "Placement admins may update non-privileged users in their university."),
      permit("super_admin", "read", "Super admins may read all users."),
      permit("super_admin", "update", "Super admins manage role and activation state."),
      permit("system", "create", "The auth callback provisions the first application user record."),
    ]),
    collection(Collections.STUDENT_PROFILES, "StudentProfile", true, [
      relation("userId", Collections.USERS, "one-to-one", true, "One student profile per app user."),
      relation("universityId", Collections.UNIVERSITIES, "many-to-one", true, "Inherited from owning user."),
      field("personalInfo", "json", true, "Private personal details object."),
      field("academic", "json", true, "Academic metrics and history object."),
      field("professional", "json", true, "Experience, skills, internships, certifications, projects."),
      field("placement", "json", true, "Placement status, offer state, and history."),
      field("customFields", "json", true, "Values backed by approved custom variables."),
      field("isProfileComplete", "boolean", true, "Used to gate student workflows."),
      timestamp("createdAt"),
      timestamp("updatedAt"),
    ], [
      index("student_profile_user_unique", "unique", ["userId"], "Enforce one profile per student."),
      index("student_profile_university_complete", "key", ["universityId", "isProfileComplete"], "Admin completion reporting."),
    ], [
      permit("student_owner", "read", "Students may read only their own private profile."),
      permit("student_owner", "update", "Students may update only their own profile."),
      permit("placement_admin", "read", "Placement admins may read profiles in their university."),
      permit("placement_admin", "update", "Placement admins may update placement fields through guarded workflows."),
      permit("super_admin", "read", "Super admins may read all student profiles."),
      permit("system", "create", "First login provisions an empty student profile."),
    ]),
    collection(Collections.RESUMES, "Resume", true, [
      relation("studentId", Collections.STUDENT_PROFILES, "many-to-one", true, "Owning student profile."),
      relation("universityId", Collections.UNIVERSITIES, "many-to-one", true, "Owning university."),
      field("fileId", "string", true, "Appwrite Storage file ID."),
      field("fileName", "string", true, "Uploaded file name."),
      field("fileSize", "integer", true, "Stored file size in bytes."),
      field("mimeType", "string", true, "Uploaded MIME type."),
      field("version", "integer", true, "Monotonic resume version number per student."),
      field("isCurrent", "boolean", true, "Marks the active resume used in workflows."),
      field("status", "enum", true, "Resume verification state.", ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]),
      field("rejectionReason", "string", false, "Admin rejection reason."),
      relation("verifiedBy", Collections.USERS, "many-to-one", false, "Admin who verified or rejected the resume."),
      field("verifiedAt", "datetime", false, "Verification decision timestamp."),
      field("uploadedAt", "datetime", true, "Upload timestamp."),
      timestamp("createdAt"),
      timestamp("updatedAt"),
    ], [
      index("resume_student_version_unique", "unique", ["studentId", "version"], "One version number per student."),
      index("resume_student_current", "key", ["studentId", "isCurrent"], "Resolve current resume quickly."),
      index("resume_university_status_uploaded", "key", ["universityId", "status", "uploadedAt"], "Admin verification queue."),
    ], [
      permit("student_owner", "read", "Students may read only their own resume records."),
      permit("student_owner", "create", "Students may create only their own resumes through guarded uploads."),
      permit("student_owner", "update", "Students may update only allowed fields on their own resumes through guarded workflows."),
      permit("student_owner", "delete", "Students may delete only their own resumes through guarded workflows."),
      permit("placement_admin", "read", "Placement admins may review resumes in their university."),
      permit("placement_admin", "update", "Placement admins may verify or reject resumes in their university."),
      permit("super_admin", "read", "Super admins may read all resumes."),
      permit("super_admin", "update", "Super admins may manage all resumes."),
      permit("system", "create", "Resume records are created by trusted upload workflows."),
    ]),
    collection(Collections.COMPANIES, "Company", false, [
      relation("universityId", Collections.UNIVERSITIES, "many-to-one", true, "Owning university."),
      field("name", "string", true, "1-255 chars."),
      field("logo", "string", false, "Optional logo file or URL."),
      field("website", "string", false, "Optional HTTPS URL."),
      field("industry", "string", false, "Optional industry label."),
      field("description", "string", false, "Optional company overview."),
      field("locations", "string[]", true, "One or more locations."),
      field("companyType", "string", false, "Startup, enterprise, services, etc."),
      field("contactInfo", "json", false, "Recruiter contact info."),
      field("participationHistory", "json", false, "Past participation metadata."),
      field("isActive", "boolean", true, "Active companies are visible to students."),
      timestamp("createdAt"),
      timestamp("updatedAt"),
    ], [
      index("company_university_name_unique", "unique", ["universityId", "name"], "Prevent duplicate company records within a university."),
      index("company_university_active", "key", ["universityId", "isActive"], "Student and admin company lists."),
    ], adminPermissions("Students may read only published or server-filtered company data.")),
    collection(Collections.ROLES, "Role", false, [
      relation("companyId", Collections.COMPANIES, "many-to-one", true, "Owning company."),
      relation("universityId", Collections.UNIVERSITIES, "many-to-one", true, "Owning university."),
      field("title", "string", true, "1-255 chars."),
      field("jdText", "string", false, "Optional job description body."),
      field("jdAttachmentId", "string", false, "Optional linked document."),
      field("location", "string", false, "Optional primary location."),
      field("workMode", "enum", false, "remote | onsite | hybrid", ["remote", "onsite", "hybrid"]),
      field("employmentType", "enum", false, "full_time | part_time | internship | contract", ["full_time", "part_time", "internship", "contract"]),
      field("ctc", "double", false, "Total compensation."),
      field("fixedCtc", "double", false, "Fixed compensation portion."),
      field("variableCtc", "double", false, "Variable compensation portion."),
      field("joiningDate", "datetime", false, "Optional joining timestamp."),
      field("experienceRequirementMonths", "integer", false, "Non-negative integer."),
      field("numberOfOpenings", "integer", false, "Positive integer."),
      field("applicationDeadline", "datetime", false, "Application close timestamp."),
      field("selectionProcessDescription", "string", false, "Optional summary of selection stages."),
      relation("eligibilityRuleSetId", Collections.ELIGIBILITY_RULES, "many-to-one", false, "Optional eligibility rule link."),
      field("requiredSkills", "string[]", true, "Normalized skills array."),
      field("requiredQualifications", "string[]", true, "Normalized qualifications array."),
      field("status", "enum", true, "draft | published | closed | cancelled", ["draft", "published", "closed", "cancelled"]),
      timestamp("createdAt"),
      timestamp("updatedAt"),
    ], [
      index("role_university_status_deadline", "key", ["universityId", "status", "applicationDeadline"], "Role browsing and deadline ordering."),
      index("role_company_status", "key", ["companyId", "status"], "Company role management."),
    ], adminPermissions("Students may read only published and authorized roles.")),
    collection(Collections.ELIGIBILITY_RULES, "EligibilityRule", true, [
      relation("universityId", Collections.UNIVERSITIES, "many-to-one", true, "Owning university."),
      relation("roleId", Collections.ROLES, "many-to-one", false, "Optional owning role."),
      field("name", "string", true, "Rule set name."),
      field("description", "string", false, "Optional rule summary."),
      field("ruleTree", "json", true, "Recursive rule AST."),
      relation("createdBy", Collections.USERS, "many-to-one", true, "Admin author."),
      timestamp("createdAt"),
      timestamp("updatedAt"),
    ], [
      index("eligibility_university_role", "key", ["universityId", "roleId"], "Resolve rule set for a role."),
      index("eligibility_university_name", "key", ["universityId", "name"], "Admin rule search."),
    ], adminPermissions("Students receive no direct access to server-evaluated rule definitions.")),
    collection(Collections.VARIABLES, "CustomVariable", true, [
      relation("universityId", Collections.UNIVERSITIES, "many-to-one", true, "Owning university."),
      field("name", "string", true, "Slug-safe key."),
      field("label", "string", true, "Display label."),
      field("type", "enum", true, "Allowed variable type.", ["string", "number", "boolean", "date", "single_select", "multi_select"]),
      field("options", "string[]", false, "Required when type is select-based."),
      field("isBuiltIn", "boolean", true, "Built-in variables cannot be removed."),
      field("description", "string", false, "Optional description."),
      timestamp("createdAt"),
      timestamp("updatedAt"),
    ], [
      index("variable_university_name_unique", "unique", ["universityId", "name"], "Prevent duplicate variable names."),
    ], adminPermissions("Students do not access variable definitions directly.")),
    collection(Collections.APPLICATIONS, "Application", true, [
      relation("studentId", Collections.STUDENT_PROFILES, "many-to-one", true, "Owning student profile."),
      relation("roleId", Collections.ROLES, "many-to-one", true, "Applied role."),
      relation("companyId", Collections.COMPANIES, "many-to-one", true, "Denormalized company link."),
      relation("universityId", Collections.UNIVERSITIES, "many-to-one", true, "Owning university."),
      field("status", "enum", true, "Application workflow status.", ["APPLIED", "SHORTLISTED", "REJECTED", "IN_ROUND", "SELECTED", "OFFERED", "ACCEPTED", "DECLINED", "WITHDRAWN"]),
      relation("currentRoundId", Collections.PLACEMENT_ROUNDS, "many-to-one", false, "Optional active round."),
      field("appliedAt", "datetime", true, "Submission timestamp."),
      field("withdrawnAt", "datetime", false, "Optional withdrawal timestamp."),
      field("lastStatusChangedAt", "datetime", true, "Latest status mutation time."),
      field("notes", "string", false, "Internal notes."),
      timestamp("createdAt"),
      timestamp("updatedAt"),
    ], [
      index("application_student_role_unique", "unique", ["studentId", "roleId"], "Prevent duplicate applications per role."),
      index("application_role_status", "key", ["roleId", "status"], "Shortlisting and workflow queues."),
      index("application_student_status", "key", ["studentId", "status"], "Student dashboard filtering."),
    ], [
      permit("student_owner", "read", "Students may read only their own applications."),
      permit("student_owner", "create", "Students may create only their own applications through server validation."),
      permit("student_owner", "update", "Students may only transition their own application through allowed actions."),
      permit("placement_admin", "read", "Placement admins may read applications in their university."),
      permit("placement_admin", "update", "Placement admins manage application workflow state."),
      permit("super_admin", "read", "Super admins may read all applications."),
    ]),
    collection(Collections.PLACEMENT_ROUNDS, "PlacementRound", true, [
      relation("roleId", Collections.ROLES, "many-to-one", true, "Owning role."),
      relation("universityId", Collections.UNIVERSITIES, "many-to-one", true, "Owning university."),
      field("name", "string", true, "Round name."),
      field("type", "enum", true, "Round type.", ["resume_shortlist", "online_assessment", "technical_interview", "managerial_interview", "hr_interview", "group_discussion", "other"]),
      field("description", "string", false, "Optional description."),
      field("instructions", "string", false, "Optional instructions."),
      field("startTime", "datetime", false, "Optional start time."),
      field("endTime", "datetime", false, "Optional end time."),
      field("location", "string", false, "Optional location."),
      field("meetingLink", "string", false, "Optional remote meeting link."),
      field("capacity", "integer", false, "Optional capacity."),
      field("evaluators", "string[]", true, "Evaluator user IDs."),
      field("status", "enum", true, "scheduled | active | completed | cancelled", ["scheduled", "active", "completed", "cancelled"]),
      field("sequence", "integer", true, "Round order within role."),
      timestamp("createdAt"),
      timestamp("updatedAt"),
    ], [
      index("round_role_sequence_unique", "unique", ["roleId", "sequence"], "Enforce round ordering."),
      index("round_university_status_start", "key", ["universityId", "status", "startTime"], "Scheduling and dashboard views."),
    ], adminPermissions("Students read only round context attached to their applications.")),
    collection(Collections.ROUND_PARTICIPANTS, "RoundParticipant", true, [
      relation("roundId", Collections.PLACEMENT_ROUNDS, "many-to-one", true, "Owning round."),
      relation("applicationId", Collections.APPLICATIONS, "many-to-one", true, "Related application."),
      relation("studentId", Collections.STUDENT_PROFILES, "many-to-one", true, "Related student."),
      field("score", "double", false, "Optional score."),
      field("passed", "boolean", false, "Optional pass marker."),
      field("notes", "string", false, "Internal notes."),
      field("resultPublished", "boolean", true, "Student visibility flag."),
      timestamp("createdAt"),
      timestamp("updatedAt"),
    ], [
      index("participant_round_application_unique", "unique", ["roundId", "applicationId"], "Prevent duplicate round assignment."),
      index("participant_student_round", "key", ["studentId", "roundId"], "Student round lookup."),
    ], adminPermissions("Students read only their own participant records.")),
    collection(Collections.RESULTS, "RoundResult", true, [
      relation("roundId", Collections.PLACEMENT_ROUNDS, "many-to-one", true, "Related round."),
      relation("applicationId", Collections.APPLICATIONS, "many-to-one", true, "Related application."),
      relation("studentId", Collections.STUDENT_PROFILES, "many-to-one", true, "Related student."),
      relation("universityId", Collections.UNIVERSITIES, "many-to-one", true, "Owning university."),
      field("outcome", "enum", true, "Result outcome.", ["PASSED", "FAILED", "WAITLISTED", "SELECTED"]),
      field("score", "double", false, "Optional score."),
      field("feedback", "string", false, "Optional feedback."),
      field("publishedAt", "datetime", false, "Controls student visibility."),
      timestamp("createdAt"),
      timestamp("updatedAt"),
    ], [
      index("result_application_round_unique", "unique", ["applicationId", "roundId"], "One result per round per application."),
      index("result_student_published", "key", ["studentId", "publishedAt"], "Student results history."),
    ], adminPermissions("Students may read only their own published results.")),
    collection(Collections.NOTIFICATIONS, "Notification", true, [
      relation("userId", Collections.USERS, "many-to-one", true, "Recipient user."),
      relation("universityId", Collections.UNIVERSITIES, "many-to-one", true, "Owning university."),
      field("type", "string", true, "Notification type key."),
      field("title", "string", true, "Notification title."),
      field("body", "string", true, "Notification body."),
      field("data", "json", false, "Structured contextual payload."),
      field("isRead", "boolean", true, "Read state."),
      field("readAt", "datetime", false, "Read timestamp."),
      timestamp("createdAt"),
    ], [
      index("notification_user_read_created", "key", ["userId", "isRead", "createdAt"], "Unread and recent notification queries."),
    ], [
      permit("student_owner", "read", "Users may read only their own notifications."),
      permit("student_owner", "update", "Users may mark only their own notifications as read."),
      permit("placement_admin", "read", "Placement admins may inspect operational notifications in their university."),
      permit("system", "create", "Notification creation happens through trusted server workflows."),
    ]),
    collection("document_metadata", "DocumentMetadata", true, [
      relation("universityId", Collections.UNIVERSITIES, "many-to-one", true, "Owning university."),
      relation("ownerUserId", Collections.USERS, "many-to-one", true, "Owning user."),
      field("entityType", "string", true, "Associated entity type."),
      field("entityId", "string", true, "Associated entity ID."),
      field("bucketId", "string", true, "Storage bucket."),
      field("fileId", "string", true, "Storage file ID."),
      field("fileName", "string", true, "Stored file name."),
      field("mimeType", "string", true, "MIME type."),
      field("fileSize", "integer", true, "Stored size in bytes."),
      field("checksum", "string", false, "Optional checksum."),
      field("tags", "string[]", true, "Search tags."),
      field("isPrivate", "boolean", true, "Visibility flag."),
      timestamp("createdAt"),
      timestamp("updatedAt"),
    ], [
      index("document_entity_lookup", "key", ["entityType", "entityId"], "Resolve files by business entity."),
      index("document_owner_created", "key", ["ownerUserId", "createdAt"], "User file history."),
    ], [
      permit("student_owner", "read", "Students may read only their own private document metadata."),
      permit("placement_admin", "read", "Placement admins may read metadata for admin-managed documents in their university."),
      permit("system", "create", "Document metadata is created server-side during uploads."),
    ]),
    collection(Collections.AUDIT_LOGS, "AuditLog", true, [
      relation("universityId", Collections.UNIVERSITIES, "many-to-one", true, "Owning university."),
      relation("actorId", Collections.USERS, "many-to-one", true, "User who triggered the action."),
      field("actorRole", "enum", true, "Role at event time.", roleEnum),
      field("action", "string", true, "Action identifier."),
      field("entityType", "string", true, "Target entity type."),
      field("entityId", "string", true, "Target entity ID."),
      field("previousValue", "json", false, "Pre-change snapshot."),
      field("newValue", "json", false, "Post-change snapshot."),
      field("ipAddress", "string", false, "Optional actor IP."),
      field("userAgent", "string", false, "Optional actor agent."),
      field("timestamp", "datetime", true, "Audit event timestamp."),
    ], [
      index("audit_university_timestamp", "key", ["universityId", "timestamp"], "University audit review."),
      index("audit_entity_lookup", "key", ["entityType", "entityId"], "Entity-level history."),
      index("audit_actor_timestamp", "key", ["actorId", "timestamp"], "Actor audit review."),
    ], [
      permit("placement_admin", "read", "Placement admins may read audit logs in their university."),
      permit("super_admin", "read", "Super admins may read all audit logs."),
      permit("system", "create", "Audit logs are append-only and written only by trusted server code."),
    ]),
    collection(Collections.PLACEMENT_RULES, "PlacementRule", true, [
      relation("universityId", Collections.UNIVERSITIES, "many-to-one", true, "Owning university."),
      field("name", "string", true, "Rule name."),
      field("description", "string", false, "Optional rule description."),
      field("ruleType", "enum", true, "Placement rule type.", ["max_applications", "max_per_company", "offer_restriction", "salary_restriction", "custom"]),
      field("config", "json", true, "Rule-specific configuration object."),
      field("isActive", "boolean", true, "Rule activation flag."),
      timestamp("createdAt"),
      timestamp("updatedAt"),
    ], [
      index("placement_rule_university_type", "key", ["universityId", "ruleType"], "Resolve applicable rules by type."),
      index("placement_rule_university_active", "key", ["universityId", "isActive"], "Active policy lookup."),
    ], adminPermissions("Students do not receive direct access to placement policy definitions.")),
  ],
};

function collection(
  id: string,
  entity: string,
  sensitive: boolean,
  fields: SchemaField[],
  indexes: SchemaIndex[],
  permissions: PermissionDecision[]
): CollectionSchema {
  return { id, entity, sensitive, fields, indexes, permissions };
}

function field(
  key: string,
  type: FieldType,
  required: boolean,
  validation: string,
  enumValues?: readonly string[]
): SchemaField {
  return { key, type, required, validation, enumValues };
}

function relation(
  key: string,
  targetCollection: string,
  kind: "one-to-one" | "many-to-one" | "one-to-many",
  required: boolean,
  validation: string
): SchemaField {
  return {
    key,
    type: "relationship",
    required,
    relationship: { targetCollection, kind },
    validation,
  };
}

function timestamp(key: string): SchemaField {
  return field(key, "datetime", true, "ISO 8601 timestamp.");
}

function index(
  key: string,
  type: SchemaIndex["type"],
  attributes: string[],
  rationale: string
): SchemaIndex {
  return { key, type, attributes, rationale };
}

function permit(
  actor: PermissionDecision["actor"],
  access: PermissionDecision["access"],
  decision: string
): PermissionDecision {
  return { actor, access, decision };
}

function adminPermissions(studentReadDecision: string): PermissionDecision[] {
  return [
    permit("student_owner", "read", studentReadDecision),
    permit("placement_admin", "read", "Placement admins may read records in their university."),
    permit("placement_admin", "create", "Placement admins may create records in their university."),
    permit("placement_admin", "update", "Placement admins may update records in their university."),
    permit("super_admin", "read", "Super admins may read all records."),
    permit("super_admin", "create", "Super admins may create records across universities."),
    permit("super_admin", "update", "Super admins may update all records."),
  ];
}
