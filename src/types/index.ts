/**
 * Application-wide TypeScript types.
 *
 * These are the core domain types used throughout Placely.
 * Appwrite document types are intersected with Models.Document in feature-level files.
 */

// ---------------------------------------------------------------------------
// User / Auth
// ---------------------------------------------------------------------------

export type UserRole = "STUDENT" | "PLACEMENT_ADMIN" | "SUPER_ADMIN";

export interface AppUser {
  /** Appwrite Auth user ID */
  $id: string;
  name: string;
  email: string;
  universityId: string;
  role: UserRole;
  isActive: boolean;
  onboardingCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// University
// ---------------------------------------------------------------------------

export interface University {
  $id: string;
  name: string;
  domain: string;
  logoUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PlacementStatus = "NOT_PLACED" | "PLACED" | "OPTED_OUT";

export interface StudentProfile {
  $id: string;
  userId: string;
  universityId: string;
  personalInfo: {
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
  };
  academic: {
    tenthPercentage?: number;
    twelfthPercentage?: number;
    diplomaPercentage?: number;
    ugDegree?: string;
    ugInstitution?: string;
    ugBranch?: string;
    ugCgpa?: number;
    graduationYear?: number;
    activeBacklogs?: number;
    totalBacklogs?: number;
    academicGaps?: number;
  };
  professional: {
    previousCompanies: string[];
    previousTitles: string[];
    totalWorkExperienceMonths?: number;
    internships: string[];
    certifications: string[];
    skills: string[];
    projects: string[];
  };
  placement: {
    status: PlacementStatus;
    numberOfOffers: number;
    currentOfferId?: string;
    currentOfferCtc?: number;
    placementHistory: string[];
    selectedCompany?: string;
    offerStatus?: string;
    verifiedAcademicData?: boolean;
  };
  customFields: Record<string, unknown>;
  isProfileComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

export type ResumeStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

export interface Resume {
  $id: string;
  studentId: string;
  universityId: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  version: number;
  isCurrent: boolean;
  status: ResumeStatus;
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  uploadedAt: string;
}

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------

export interface Company {
  $id: string;
  universityId: string;
  name: string;
  logo?: string;
  website?: string;
  industry?: string;
  description?: string;
  locations: string[];
  companyType?: string;
  contactInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Role
// ---------------------------------------------------------------------------

export type RoleStatus = "draft" | "published" | "closed" | "cancelled";
export type WorkMode = "remote" | "onsite" | "hybrid";
export type EmploymentType =
  | "full_time"
  | "part_time"
  | "internship"
  | "contract";

export interface Role {
  $id: string;
  companyId: string;
  universityId: string;
  title: string;
  jdText?: string;
  jdAttachmentId?: string;
  location?: string;
  workMode?: WorkMode;
  employmentType?: EmploymentType;
  ctc?: number;
  fixedCtc?: number;
  variableCtc?: number;
  joiningDate?: string;
  experienceRequirementMonths?: number;
  numberOfOpenings?: number;
  applicationDeadline?: string;
  selectionProcessDescription?: string;
  eligibilityRuleSetId?: string;
  requiredSkills: string[];
  requiredQualifications: string[];
  status: RoleStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

export type ApplicationStatus =
  | "APPLIED"
  | "SHORTLISTED"
  | "REJECTED"
  | "IN_ROUND"
  | "SELECTED"
  | "OFFERED"
  | "ACCEPTED"
  | "DECLINED"
  | "WITHDRAWN";

export interface Application {
  $id: string;
  studentId: string;
  roleId: string;
  companyId: string;
  universityId: string;
  status: ApplicationStatus;
  currentRoundId?: string;
  appliedAt: string;
  withdrawnAt?: string;
  lastStatusChangedAt: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type BulkOperationStatus = "queued" | "running" | "completed" | "failed";

export type BulkOperationAction =
  | "bulk_shortlist"
  | "auto_shortlist"
  | "bulk_reject"
  | "bulk_move_to_round"
  | "csv_import"
  | "csv_export";

export interface BulkOperation {
  $id: string;
  universityId: string;
  actorId: string;
  actorRole: UserRole;
  action: BulkOperationAction;
  status: BulkOperationStatus;
  targetCount: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  input: Record<string, unknown>;
  summary?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Placement Round
// ---------------------------------------------------------------------------

export type RoundType =
  | "resume_shortlist"
  | "online_assessment"
  | "technical_interview"
  | "managerial_interview"
  | "hr_interview"
  | "group_discussion"
  | "other";

export type RoundStatus =
  | "scheduled"
  | "active"
  | "completed"
  | "cancelled";

export interface PlacementRound {
  $id: string;
  roleId: string;
  universityId: string;
  name: string;
  type: RoundType;
  description?: string;
  instructions?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  meetingLink?: string;
  capacity?: number;
  evaluators: string[];
  status: RoundStatus;
  sequence: number;
  createdAt: string;
  updatedAt: string;
}

export type RoundOutcome = "PASSED" | "FAILED" | "WAITLISTED" | "SELECTED";

export interface RoundParticipant {
  $id: string;
  roundId: string;
  applicationId: string;
  studentId: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  location?: string;
  meetingLink?: string;
  instructions?: string;
  interviewerIds: string[];
  score?: number;
  passed?: boolean;
  notes?: string;
  resultPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoundResult {
  $id: string;
  roundId: string;
  applicationId: string;
  studentId: string;
  universityId: string;
  outcome: RoundOutcome;
  score?: number;
  feedback?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

export type NotificationType =
  | "COMPANY_PUBLISHED"
  | "APPLICATION_SUBMITTED"
  | "SHORTLISTED"
  | "ROUND_SCHEDULED"
  | "ROUND_UPDATED"
  | "RESULT_PUBLISHED"
  | "DEADLINE_REMINDER"
  | "ANNOUNCEMENT";

export interface Notification {
  $id: string;
  userId: string;
  universityId: string;
  type: NotificationType;
  templateKey: string;
  dedupeKey: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationTemplate {
  $id: string;
  universityId: string;
  type: NotificationType;
  channel: "in_app" | "email";
  subjectTemplate: string;
  titleTemplate: string;
  bodyTemplate: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  $id: string;
  universityId: string;
  title: string;
  body: string;
  isImportant: boolean;
  publishedAt: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Eligibility Engine
// ---------------------------------------------------------------------------

export type RuleOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "not_contains"
  | "in"
  | "not_in"
  | "before"
  | "on_or_before"
  | "after"
  | "on_or_after";

export type RuleValue =
  | string
  | number
  | boolean
  | null
  | Array<string | number | boolean>;

export interface ConditionNode {
  type: "condition";
  variable: string;
  operator: RuleOperator;
  value: RuleValue;
}

export interface GroupNode {
  type: "group";
  logic: "AND" | "OR" | "NOT";
  children: RuleNode[];
}

export type RuleNode = ConditionNode | GroupNode;

export interface EligibilityRuleSet {
  $id: string;
  universityId: string;
  roleId?: string;
  name: string;
  description?: string;
  ruleTree: RuleNode;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Variable System
// ---------------------------------------------------------------------------

export type VariableType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "single_select"
  | "multi_select";

export interface Variable {
  $id: string;
  universityId: string;
  id: string;
  name: string;
  label: string;
  description?: string;
  type: VariableType;
  options?: string[];
  source: "built_in" | "custom";
  isActive: boolean;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoundParticipant {
  $id: string;
  roundId: string;
  applicationId: string;
  studentId: string;
  score?: number;
  passed?: boolean;
  notes?: string;
  resultPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoundResult {
  $id: string;
  roundId: string;
  applicationId: string;
  studentId: string;
  universityId: string;
  outcome: "PASSED" | "FAILED" | "WAITLISTED" | "SELECTED";
  score?: number;
  feedback?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMetadata {
  $id: string;
  universityId: string;
  ownerUserId: string;
  entityType: string;
  entityId: string;
  bucketId: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum?: string;
  tags: string[];
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlacementRule {
  $id: string;
  universityId: string;
  name: string;
  description?: string;
  ruleType:
    | "max_applications_per_student"
    | "max_applications_per_company"
    | "max_active_applications"
    | "offer_based_restriction"
    | "ctc_based_restriction"
    | "selected_student_restriction"
    | "round_specific_restriction"
    | "custom";
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

export interface AuditLog {
  $id: string;
  universityId: string;
  actorId: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  documents: T[];
  total: number;
  hasMore: boolean;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  cursor?: string;
  cursorDirection?: "before" | "after";
}

// ---------------------------------------------------------------------------
// API Response
// ---------------------------------------------------------------------------

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
