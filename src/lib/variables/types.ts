import type { VariableType } from "@/types";

export type VariableSource = "built_in" | "custom";

export interface VariableDefinition {
  $id: string;
  universityId: string;
  id: string;
  name: string;
  label: string;
  description?: string;
  type: VariableType;
  options?: string[];
  source: VariableSource;
  isActive: boolean;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VariableDefinitionInput {
  name: string;
  label: string;
  description?: string;
  type: VariableType;
  options?: string[];
  isActive?: boolean;
}

export interface VariableValueValidationResult {
  valid: boolean;
  errors: string[];
  normalizedValues: Record<string, unknown>;
}
