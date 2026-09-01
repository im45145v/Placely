import { ID, Models, Query } from "node-appwrite";
import { Collections, DATABASE_ID } from "@/lib/appwrite/constants";
import { getServerDatabases } from "@/lib/appwrite/server";
import { createAuditLog } from "@/lib/audit/service";
import { AppError } from "@/lib/errors";
import type { AppUser, StudentProfile, VariableType } from "@/types";
import { BUILT_IN_VARIABLES } from "./builtins";
import type {
  VariableDefinition,
  VariableDefinitionInput,
  VariableValueValidationResult,
} from "./types";

export async function listVariablesForUniversity(actor: AppUser): Promise<VariableDefinition[]> {
  const databases = getServerDatabases();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.VARIABLES,
    [Query.equal("universityId", actor.universityId), Query.limit(100)]
  );

  const customVariables = result.documents.map(docToVariableDefinition);
  return [...BUILT_IN_VARIABLES, ...customVariables].sort((left, right) => left.label.localeCompare(right.label));
}

export async function listActiveVariablesForUniversity(actor: AppUser): Promise<VariableDefinition[]> {
  const variables = await listVariablesForUniversity(actor);
  return variables.filter((variable) => variable.isActive);
}

export async function createVariableForAdmin(actor: AppUser, input: VariableDefinitionInput): Promise<VariableDefinition> {
  const payload = normalizeVariableDefinitionInput(input);
  const databases = getServerDatabases();
  const now = new Date().toISOString();
  const created = await databases.createDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.VARIABLES,
    ID.unique(),
    {
      universityId: actor.universityId,
      name: payload.name,
      label: payload.label,
      description: payload.description ?? null,
      type: payload.type,
      options: payload.options ?? [],
      source: "custom",
      isActive: payload.isActive ?? true,
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    }
  );
  const variable = docToVariableDefinition(created);
  await createAuditLog(actor, {
    action: "permission.created",
    entityType: "variable_permission",
    entityId: variable.$id,
    newValue: variable as unknown as Record<string, unknown>,
  });
  return variable;
}

export async function updateVariableForAdmin(
  actor: AppUser,
  variableId: string,
  input: VariableDefinitionInput
): Promise<VariableDefinition> {
  const existing = await readScopedVariable(actor, variableId);
  if (existing.isBuiltIn) {
    throw AppError.forbidden("Built-in variables cannot be edited.");
  }

  const payload = normalizeVariableDefinitionInput(input);
  const databases = getServerDatabases();
  const updated = await databases.updateDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.VARIABLES,
    variableId,
    {
      name: payload.name,
      label: payload.label,
      description: payload.description ?? null,
      type: payload.type,
      options: payload.options ?? [],
      isActive: payload.isActive ?? true,
      updatedAt: new Date().toISOString(),
    }
  );
  const variable = docToVariableDefinition(updated);
  await createAuditLog(actor, {
    action: "permission.updated",
    entityType: "variable_permission",
    entityId: variableId,
    previousValue: existing as unknown as Record<string, unknown>,
    newValue: variable as unknown as Record<string, unknown>,
  });
  return variable;
}

export async function deleteVariableForAdmin(actor: AppUser, variableId: string): Promise<void> {
  const existing = await readScopedVariable(actor, variableId);
  if (existing.isBuiltIn) {
    throw AppError.forbidden("Built-in variables cannot be deleted.");
  }

  const databases = getServerDatabases();
  await databases.deleteDocument(DATABASE_ID, Collections.VARIABLES, variableId);
  await createAuditLog(actor, {
    action: "permission.deleted",
    entityType: "variable_permission",
    entityId: variableId,
    previousValue: existing as unknown as Record<string, unknown>,
  });
}

export async function getVariableMapForUniversity(actor: AppUser, activeOnly = false): Promise<Map<string, VariableDefinition>> {
  const variables = activeOnly
    ? await listActiveVariablesForUniversity(actor)
    : await listVariablesForUniversity(actor);
  return new Map(variables.map((variable) => [variable.name, variable]));
}

export function validateVariableValues(
  definitions: Iterable<VariableDefinition>,
  values: Record<string, unknown>
): VariableValueValidationResult {
  const errors: string[] = [];
  const normalizedValues: Record<string, unknown> = {};
  const variableMap = new Map(Array.from(definitions, (definition) => [definition.name, definition]));

  for (const [name, rawValue] of Object.entries(values)) {
    const definition = variableMap.get(name);
    if (!definition || !definition.isActive) {
      errors.push(`Unknown or inactive variable "${name}".`);
      continue;
    }

    try {
      normalizedValues[name] = normalizeVariableValue(definition.type, rawValue, definition.options);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Invalid value for "${name}".`);
    }
  }

  return { valid: errors.length === 0, errors, normalizedValues };
}

export function normalizeVariableValue(
  type: VariableType,
  value: unknown,
  options?: string[]
): unknown {
  if (value === null || value === undefined || value === "") {
    return type === "multi_select" ? [] : null;
  }

  switch (type) {
    case "string": {
      if (typeof value !== "string") {
        throw AppError.validationError("Expected a string value.");
      }
      return value.trim();
    }
    case "number": {
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw AppError.validationError("Expected a valid number value.");
      }
      return value;
    }
    case "boolean": {
      if (typeof value !== "boolean") {
        throw AppError.validationError("Expected a boolean value.");
      }
      return value;
    }
    case "date": {
      if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
        throw AppError.validationError("Expected a valid ISO date value.");
      }
      return value;
    }
    case "single_select": {
      if (typeof value !== "string") {
        throw AppError.validationError("Expected a string option value.");
      }
      const normalized = value.trim();
      if (!normalized) {
        return null;
      }
      assertOption(normalized, options);
      return normalized;
    }
    case "multi_select": {
      if (!Array.isArray(value)) {
        throw AppError.validationError("Expected an array of option values.");
      }
      const normalized = value.map((item) => {
        if (typeof item !== "string") {
          throw AppError.validationError("Expected multi-select values to be strings.");
        }
        const option = item.trim();
        assertOption(option, options);
        return option;
      });
      return Array.from(new Set(normalized));
    }
    default:
      return value;
  }
}

export function extractVariableValuesFromStudentProfile(
  profile: StudentProfile,
  customFieldValues: Record<string, unknown> = profile.customFields
): Record<string, unknown> {
  return {
    cgpa: profile.academic.ugCgpa ?? null,
    active_backlogs: profile.academic.activeBacklogs ?? null,
    total_backlogs: profile.academic.totalBacklogs ?? null,
    academic_gaps: profile.academic.academicGaps ?? null,
    ug_branch: profile.academic.ugBranch ?? null,
    ug_degree: profile.academic.ugDegree ?? null,
    graduation_year: profile.academic.graduationYear ?? null,
    work_experience_months: profile.professional.totalWorkExperienceMonths ?? null,
    is_profile_complete: profile.isProfileComplete,
    placement_status: profile.placement.status,
    verified_academic_data: profile.placement.verifiedAcademicData ?? false,
    number_of_offers: profile.placement.numberOfOffers ?? 0,
    date_of_birth: profile.personalInfo.dateOfBirth ?? null,
    skills: profile.professional.skills ?? [],
    certifications: profile.professional.certifications ?? [],
    internships: profile.professional.internships ?? [],
    ...customFieldValues,
  };
}

export async function buildVariableContextForUniversity(actor: AppUser): Promise<{
  definitions: VariableDefinition[];
  variableMap: Map<string, VariableDefinition>;
}> {
  const definitions = await listActiveVariablesForUniversity(actor);
  return {
    definitions,
    variableMap: new Map(definitions.map((variable) => [variable.name, variable])),
  };
}

function normalizeVariableDefinitionInput(input: VariableDefinitionInput): VariableDefinitionInput {
  const name = slugifyVariableName(input.name);
  const label = cleanRequired(input.label, "label", 1, 120);
  const description = cleanOptional(input.description, 240);
  const options = normalizeVariableOptions(input.type, input.options);

  return {
    name,
    label,
    description,
    type: input.type,
    options,
    isActive: input.isActive ?? true,
  };
}

function normalizeVariableOptions(type: VariableType, input: string[] | undefined): string[] | undefined {
  const requiresOptions = type === "single_select" || type === "multi_select";
  if (!requiresOptions) {
    return undefined;
  }

  if (!input || input.length === 0) {
    throw AppError.validationError("Select variables require at least one option.");
  }

  const options = Array.from(
    new Set(
      input
        .map((item) => cleanRequired(item, "option", 1, 120))
        .filter(Boolean)
    )
  );

  if (options.length === 0) {
    throw AppError.validationError("Select variables require at least one option.");
  }

  return options;
}

async function readScopedVariable(actor: AppUser, variableId: string): Promise<VariableDefinition> {
  const variables = await listVariablesForUniversity(actor);
  const variable = variables.find((item) => item.$id === variableId || item.id === variableId);
  if (!variable) {
    throw AppError.notFound("Variable not found.");
  }
  return variable;
}

function docToVariableDefinition(doc: Models.DefaultDocument): VariableDefinition {
  return {
    $id: doc.$id,
    universityId: String(doc.universityId),
    id: doc.$id,
    name: String(doc.name),
    label: String(doc.label),
    description: cleanMaybeString(doc.description),
    type: doc.type as VariableType,
    options: Array.isArray(doc.options) && doc.options.length > 0 ? (doc.options as string[]) : undefined,
    source: (doc.source as VariableDefinition["source"]) ?? "custom",
    isActive: Boolean(doc.isActive ?? true),
    isBuiltIn: Boolean(doc.isBuiltIn),
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

function slugifyVariableName(value: string): string {
  const normalized = cleanRequired(value, "name", 1, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) {
    throw AppError.validationError("Variable name must contain letters or numbers.");
  }
  return normalized;
}

function cleanRequired(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") {
    throw AppError.validationError(`${field} must be a string.`);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw AppError.validationError(`${field} must be between ${min} and ${max} characters.`);
  }
  return normalized;
}

function cleanOptional(value: unknown, max: number): string | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const normalized = cleanRequired(value, "description", 1, max);
  return normalized;
}

function cleanMaybeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function assertOption(option: string, options?: string[]): void {
  if (!option) {
    throw AppError.validationError("Option values cannot be empty.");
  }
  if (options && !options.includes(option)) {
    throw AppError.validationError(`Invalid option "${option}".`);
  }
}
