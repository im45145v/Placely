import type { EligibilityRuleSet, RuleNode, RuleOperator, RuleValue, Variable, VariableType } from "@/types";

export type EligibilityComparableValue = string | number | boolean | Date | null;

export interface EligibilityVariableDefinition {
  name: string;
  label: string;
  type: VariableType;
  description?: string;
  options?: string[];
  isBuiltIn: boolean;
}

export interface EligibilityStudentRecord {
  userId: string;
  profileId: string;
  universityId: string;
  values: Record<string, unknown>;
}

export interface EligibilityEvaluationContext {
  variables: Map<string, EligibilityVariableDefinition>;
  now?: Date;
}

export interface EligibilityPreviewResult {
  totalStudents: number;
  eligibleStudents: number;
  removedStudents: number;
  addedStudents: number;
  currentRule: RuleNode | null;
  draftRule: RuleNode | null;
}

export interface EligibilityResult {
  eligible: boolean;
  evaluatedAt: string;
  ruleSetId?: string;
  studentProfileId: string;
}

export type EligibilityRuleDraft = Pick<EligibilityRuleSet, "name" | "description" | "ruleTree">;

export interface EligibilityRuleValidationResult {
  valid: boolean;
  errors: string[];
}

export type PersistedVariableDefinition = Variable | EligibilityVariableDefinition;
export type { RuleNode, RuleOperator, RuleValue };
