import type { EligibilityRuleSet, RuleNode, RuleOperator, RuleValue, VariableType } from "@/types";
import type { VariableDefinition } from "@/lib/variables/types";

export type EligibilityComparableValue = string | number | boolean | Date | null;

export interface EligibilityVariableDefinition {
  $id?: string;
  id?: string;
  universityId?: string;
  name: string;
  label: string;
  type: VariableType;
  description?: string;
  options?: string[];
  source?: "built_in" | "custom";
  isActive?: boolean;
  isBuiltIn: boolean;
  createdAt?: string;
  updatedAt?: string;
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

export type PersistedVariableDefinition = VariableDefinition | EligibilityVariableDefinition;
export type { RuleNode, RuleOperator, RuleValue };
