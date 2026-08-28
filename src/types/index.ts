/**
 * Application-wide TypeScript types.
 *
 * These are the core domain types used throughout Placely.
 * Appwrite document types are intersected with Models.Document in feature-level files.
 */

// ---------------------------------------------------------------------------
// User / Auth
// ---------------------------------------------------------------------------

export type UserRole = "student" | "placement_admin" | "super_admin";

export interface AppUser {
  /** Appwrite Auth user ID */
  $id: string;
  name: string;
  email: string;
  universityId: string;
  role: UserRole;
  isActive: boolean;
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

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

export type NotificationType =
  | "role_published"
  | "eligible_role"
  | "application_submitted"
  | "shortlisted"
  | "round_scheduled"
  | "round_rescheduled"
  | "result_published"
  | "deadline_approaching"
  | "deadline_reached"
  | "announcement"
  | "general";

export interface Notification {
  $id: string;
  userId: string;
  universityId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
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
  | "in"
  | "not_in";

export interface ConditionNode {
  type: "condition";
  variable: string;
  operator: RuleOperator;
  value: string | number | boolean | string[];
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
  name: string;
  label: string;
  type: VariableType;
  options?: string[];
  isBuiltIn: boolean;
  description?: string;
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
