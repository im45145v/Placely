import type { ApplicationStatus, PlacementRule, PlacementStatus, Role, RoundType } from "@/types";

export type PlacementRuleType = PlacementRule["ruleType"];

export interface MaxApplicationsPerStudentConfig {
  maxApplications: number;
  statuses?: ApplicationStatus[];
}

export interface MaxApplicationsPerCompanyConfig {
  maxApplications: number;
  statuses?: ApplicationStatus[];
}

export interface MaxActiveApplicationsConfig {
  maxActiveApplications: number;
}

export interface OfferBasedRestrictionConfig {
  blockIfPlaced?: boolean;
  maxOffers?: number;
  blockedPlacementStatuses?: PlacementStatus[];
  blockedOfferStatuses?: string[];
}

export interface CtcBasedRestrictionConfig {
  triggerOnCurrentOfferCtcGte?: number;
  disallowRoleCtcBelow?: number;
  minimumPercentAboveCurrentOffer?: number;
  minimumAbsoluteIncreaseLpa?: number;
  ignoreRolesWithoutCtc?: boolean;
}

export interface SelectedStudentRestrictionConfig {
  blockIfSelected?: boolean;
  selectedStatuses?: ApplicationStatus[];
  companyScope?: "any" | "same_company";
}

export interface RoundSpecificRestrictionConfig {
  blockedRoundTypes?: RoundType[];
  blockedRoundIds?: string[];
  applicationStatuses?: ApplicationStatus[];
  scope?: "any" | "same_company" | "same_role";
}

export interface PlacementRuleViolation {
  ruleId: string;
  ruleName: string;
  ruleType: PlacementRuleType;
  message: string;
  details?: Record<string, unknown>;
}

export interface PlacementRuleEvaluationResult {
  allowed: boolean;
  violations: PlacementRuleViolation[];
}

export interface PlacementRuleContext {
  studentUserId: string;
  studentProfileId: string;
  role: Role;
  companyName?: string;
}

export interface PlacementRuleInput {
  name: string;
  description?: string;
  ruleType: PlacementRuleType;
  config: Record<string, unknown>;
  isActive?: boolean;
}
