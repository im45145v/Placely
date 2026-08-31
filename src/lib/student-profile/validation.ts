import { AppError } from "@/lib/errors";
import type {
  StudentAcademicData,
  StudentIdentityUpdate,
  StudentPlacementEditableData,
  StudentProfessionalData,
  StudentProfileUpdatePayload,
} from "./types";

export function validateStudentProfileUpdatePayload(
  payload: unknown
): StudentProfileUpdatePayload {
  if (!payload || typeof payload !== "object") {
    throw AppError.validationError("Profile update payload must be an object.");
  }

  const value = payload as Record<string, unknown>;

  return {
    identity: validateIdentity(value.identity),
    academic: validateAcademic(value.academic),
    professional: validateProfessional(value.professional),
    placement: validatePlacement(value.placement),
    customFields: validateCustomFields(value.customFields),
  };
}

function validateCustomFields(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  assertObject(value, "customFields");
  return value as Record<string, unknown>;
}

function validateIdentity(value: unknown): Partial<StudentIdentityUpdate> | undefined {
  if (value === undefined) {
    return undefined;
  }
  assertObject(value, "identity");

  const identity = value as Record<string, unknown>;
  const next: Partial<StudentIdentityUpdate> = {};

  if ("name" in identity) {
    next.name = validateString(identity.name, "identity.name", 1, 120);
  }
  if ("phone" in identity) {
    next.phone = validateOptionalString(identity.phone, "identity.phone", 7, 20);
  }
  if ("dateOfBirth" in identity) {
    next.dateOfBirth = validateIsoDate(identity.dateOfBirth, "identity.dateOfBirth");
  }
  if ("gender" in identity) {
    next.gender = validateOptionalString(identity.gender, "identity.gender", 1, 40);
  }

  return next;
}

function validateAcademic(value: unknown): Partial<StudentAcademicData> | undefined {
  if (value === undefined) {
    return undefined;
  }
  assertObject(value, "academic");

  const academic = value as Record<string, unknown>;
  const next: Partial<StudentAcademicData> = {};

  assignNumber(next, "tenthPercentage", academic.tenthPercentage, 0, 100);
  assignNumber(next, "twelfthPercentage", academic.twelfthPercentage, 0, 100);
  assignNumber(next, "diplomaPercentage", academic.diplomaPercentage, 0, 100);
  assignString(next, "ugDegree", academic.ugDegree, 1, 120);
  assignString(next, "ugInstitution", academic.ugInstitution, 1, 160);
  assignString(next, "ugBranch", academic.ugBranch, 1, 120);
  assignNumber(next, "ugCgpa", academic.ugCgpa, 0, 10);
  assignNumber(next, "graduationYear", academic.graduationYear, 2000, 2100, true);
  assignNumber(next, "activeBacklogs", academic.activeBacklogs, 0, 100, true);
  assignNumber(next, "totalBacklogs", academic.totalBacklogs, 0, 100, true);
  assignNumber(next, "academicGaps", academic.academicGaps, 0, 20, true);

  return next;
}

function validateProfessional(
  value: unknown
): Partial<StudentProfessionalData> | undefined {
  if (value === undefined) {
    return undefined;
  }
  assertObject(value, "professional");

  const professional = value as Record<string, unknown>;
  const next: Partial<StudentProfessionalData> = {};

  assignStringArray(next, "previousCompanies", professional.previousCompanies);
  assignStringArray(next, "previousTitles", professional.previousTitles);
  assignNumber(next, "totalWorkExperienceMonths", professional.totalWorkExperienceMonths, 0, 600, true);
  assignStringArray(next, "internships", professional.internships);
  assignStringArray(next, "certifications", professional.certifications);
  assignStringArray(next, "skills", professional.skills);
  assignStringArray(next, "projects", professional.projects);

  return next;
}

function validatePlacement(
  value: unknown
): StudentPlacementEditableData | undefined {
  if (value === undefined) {
    return undefined;
  }
  assertObject(value, "placement");

  const placement = value as Record<string, unknown>;
  const next: StudentPlacementEditableData = {};

  if ("optedOut" in placement) {
    if (typeof placement.optedOut !== "boolean") {
      throw AppError.validationError("placement.optedOut must be a boolean.");
    }
    next.optedOut = placement.optedOut;
  }

  return next;
}

function assertObject(value: unknown, field: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw AppError.validationError(`${field} must be an object.`);
  }
}

function validateString(
  value: unknown,
  field: string,
  min: number,
  max: number
): string {
  if (typeof value !== "string") {
    throw AppError.validationError(`${field} must be a string.`);
  }

  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw AppError.validationError(`${field} must be between ${min} and ${max} characters.`);
  }
  return trimmed;
}

function validateOptionalString(
  value: unknown,
  field: string,
  min: number,
  max: number
): string | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  return validateString(value, field, min, max);
}

function validateIsoDate(value: unknown, field: string): string | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw AppError.validationError(`${field} must be a valid date string.`);
  }
  return value;
}

function assignString<T extends object>(
  target: T,
  key: keyof T,
  value: unknown,
  min: number,
  max: number
): void {
  if (value !== undefined) {
    (target as Record<string, unknown>)[key as string] = validateOptionalString(
      value,
      String(key),
      min,
      max
    );
  }
}

function assignNumber<T extends object>(
  target: T,
  key: keyof T,
  value: unknown,
  min: number,
  max: number,
  integer = false
): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw AppError.validationError(`${String(key)} must be a number.`);
  }
  if (value < min || value > max) {
    throw AppError.validationError(`${String(key)} must be between ${min} and ${max}.`);
  }
  if (integer && !Number.isInteger(value)) {
    throw AppError.validationError(`${String(key)} must be an integer.`);
  }
  (target as Record<string, unknown>)[key as string] = value;
}

function assignStringArray<T extends object>(
  target: T,
  key: keyof T,
  value: unknown
): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    throw AppError.validationError(`${String(key)} must be an array of strings.`);
  }
  const normalized = value.map((item) => {
    if (typeof item !== "string") {
      throw AppError.validationError(`${String(key)} must contain only strings.`);
    }
    const trimmed = item.trim();
    if (!trimmed) {
      throw AppError.validationError(`${String(key)} cannot contain empty values.`);
    }
    if (trimmed.length > 120) {
      throw AppError.validationError(`${String(key)} values must be at most 120 characters.`);
    }
    return trimmed;
  });
  (target as Record<string, unknown>)[key as string] = normalized;
}
