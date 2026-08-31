import type { AppUser } from "@/types";
import type {
  AdminPlacementData,
  StudentAcademicData,
  StudentIdentityUpdate,
  StudentPlacementEditableData,
  StudentProfessionalData,
  StudentProfileUpdatePayload,
} from "./types";

export const STUDENT_EDITABLE_PLACEMENT_FIELDS = ["optedOut"] as const;

export function canViewStudentProfile(
  actor: AppUser | null,
  ownerUserId: string,
  ownerUniversityId: string
): boolean {
  if (!actor) {
    return false;
  }

  if (actor.role === "SUPER_ADMIN") {
    return true;
  }

  if (actor.role === "PLACEMENT_ADMIN") {
    return actor.universityId === ownerUniversityId;
  }

  return actor.$id === ownerUserId;
}

export function canEditStudentProfile(
  actor: AppUser | null,
  ownerUserId: string,
  ownerUniversityId: string
): boolean {
  if (!actor) {
    return false;
  }

  if (actor.role === "SUPER_ADMIN") {
    return true;
  }

  if (actor.role === "PLACEMENT_ADMIN") {
    return actor.universityId === ownerUniversityId;
  }

  return actor.$id === ownerUserId;
}

export function isStudentSelf(actor: AppUser, ownerUserId: string): boolean {
  return actor.role === "STUDENT" && actor.$id === ownerUserId;
}

export function sanitizeStudentProfilePayloadForStudent(
  payload: StudentProfileUpdatePayload
): StudentProfileUpdatePayload {
  return {
    identity: payload.identity,
    academic: payload.academic,
    professional: payload.professional,
    placement: payload.placement
      ? { optedOut: payload.placement.optedOut }
      : undefined,
  };
}

export function buildPlacementFromStudentInput(
  existing: AdminPlacementData,
  input?: StudentPlacementEditableData
): AdminPlacementData {
  if (!input || typeof input.optedOut !== "boolean") {
    return existing;
  }

  return {
    ...existing,
    status: input.optedOut ? "OPTED_OUT" : existing.status === "OPTED_OUT" ? "NOT_PLACED" : existing.status,
  };
}

export function normalizeIdentityInput(
  input: Partial<StudentIdentityUpdate> | undefined
): Partial<StudentIdentityUpdate> {
  if (!input) {
    return {};
  }

  return {
    name: normalizeOptionalString(input.name) ?? "",
    phone: normalizeOptionalString(input.phone),
    dateOfBirth: normalizeOptionalString(input.dateOfBirth),
    gender: normalizeOptionalString(input.gender),
  };
}

export function normalizeAcademicInput(
  input: Partial<StudentAcademicData> | undefined
): Partial<StudentAcademicData> {
  return input ?? {};
}

export function normalizeProfessionalInput(
  input: Partial<StudentProfessionalData> | undefined
): Partial<StudentProfessionalData> {
  if (!input) {
    return {};
  }

  return {
    previousCompanies: normalizeStringArray(input.previousCompanies),
    previousTitles: normalizeStringArray(input.previousTitles),
    totalWorkExperienceMonths: input.totalWorkExperienceMonths,
    internships: normalizeStringArray(input.internships),
    certifications: normalizeStringArray(input.certifications),
    skills: normalizeStringArray(input.skills),
    projects: normalizeStringArray(input.projects),
  };
}

export function calculateProfileCompletion(input: {
  identity: Pick<StudentIdentityUpdate, "name"> &
    Partial<Omit<StudentIdentityUpdate, "name">> & { email: string };
  academic: StudentAcademicData;
  professional: StudentProfessionalData;
}): number {
  const checks = [
    Boolean(input.identity.name.trim()),
    Boolean(input.identity.email.trim()),
    Boolean(input.identity.phone?.trim()),
    Boolean(input.identity.dateOfBirth?.trim()),
    Boolean(input.academic.ugDegree?.trim()),
    Boolean(input.academic.ugInstitution?.trim()),
    Boolean(input.academic.ugBranch?.trim()),
    typeof input.academic.ugCgpa === "number",
    typeof input.academic.tenthPercentage === "number",
    typeof input.academic.twelfthPercentage === "number",
    typeof input.academic.graduationYear === "number",
    Array.isArray(input.professional.skills) && input.professional.skills.length > 0,
    Array.isArray(input.professional.projects) && input.professional.projects.length > 0,
    typeof input.professional.totalWorkExperienceMonths === "number" ||
      input.professional.internships.length > 0 ||
      input.professional.previousCompanies.length > 0,
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeStringArray(values: string[] | undefined): string[] | undefined {
  if (!values) {
    return undefined;
  }

  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 50);
}
