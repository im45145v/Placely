import type {
  Application,
  ApplicationStatus,
  BulkOperation,
  Company,
  PlacementRound,
  Role,
  RoundParticipant,
  RoundResult,
  RuleNode,
} from "@/types";
import type { VariableDefinition } from "@/lib/variables/types";

export interface ApplicationTimelineEntry {
  $id: string;
  action: string;
  actorId: string;
  actorRole: string;
  timestamp: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

export interface ApplicationStudentSummary {
  userId: string;
  name: string;
  email: string;
  profileId: string;
  variableValues: Record<string, unknown>;
}

export interface ApplicationDetail extends Application {
  role: Role;
  company: Company;
  student: ApplicationStudentSummary;
  timeline: ApplicationTimelineEntry[];
  workflow: ApplicationRoundWorkflow[];
  currentRound?: ApplicationRoundWorkflow;
}

export interface ApplicationRoundWorkflow {
  round: PlacementRound;
  participant?: RoundParticipant;
  result?: RoundResult;
  state: "upcoming" | "active" | "completed" | "rejected" | "selected";
}

export interface ApplicationFilters {
  search?: string;
  status?: ApplicationStatus | "all";
  roleId?: string;
  companyId?: string;
  studentFilter?: RuleNode | null;
  page?: number;
}

export interface PaginatedApplications<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminApplicationActionInput {
  applicationId: string;
  notes?: string;
}

export interface AdminBulkApplicationActionInput {
  applicationIds: string[];
  notes?: string;
}

export interface BulkActionMode {
  mode: "selection" | "filtered";
}

export interface BulkActionResult {
  mode: "direct" | "queued";
  operation: BulkOperation;
  applications?: ApplicationDetail[];
}

export interface BulkOperationSummary {
  operation: BulkOperation;
  applications: ApplicationDetail[];
}

export interface ApplicationCsvImportRow {
  applicationId: string;
  action: "shortlist" | "reject" | "move_to_round";
  roundId?: string;
  notes?: string;
}

export interface ApplicationAdminPageData {
  applications: PaginatedApplications<ApplicationDetail>;
  rounds: PlacementRound[];
  variables: VariableDefinition[];
}
