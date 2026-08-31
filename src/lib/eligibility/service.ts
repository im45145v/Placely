import { ID, Models, Query } from "node-appwrite";
import { Collections, DATABASE_ID } from "@/lib/appwrite/constants";
import { getServerDatabases } from "@/lib/appwrite/server";
import { calculateProfileCompletion } from "@/lib/student-profile/rules";
import type { AppUser, EligibilityRuleSet, StudentProfile } from "@/types";
import { AppError } from "@/lib/errors";
import { evaluateEligibilityRule, validateEligibilityRuleTree } from "./engine";
import type {
  EligibilityResult,
  EligibilityPreviewResult,
  EligibilityRuleDraft,
  EligibilityStudentRecord,
  EligibilityVariableDefinition,
} from "./types";
import {
  buildVariableContextForUniversity,
  extractVariableValuesFromStudentProfile,
} from "@/lib/variables/service";

export async function listEligibilityVariablesForUniversity(
  actor: AppUser
): Promise<EligibilityVariableDefinition[]> {
  const context = await buildVariableContextForUniversity(actor);
  return context.definitions;
}

export async function previewEligibilityForRole(
  actor: AppUser,
  currentRuleTree: EligibilityRuleSet["ruleTree"] | null,
  draftRuleTree: EligibilityRuleSet["ruleTree"] | null
): Promise<EligibilityPreviewResult> {
  const variables = await loadVariableMap(actor);
  const students = await loadEligibilityStudentRecords(actor.universityId);
  const context = { variables };
  assertValidRule(currentRuleTree, context);
  assertValidRule(draftRuleTree, context);

  const currentEligibleIds = new Set(
    students.filter((student) => evaluateEligibilityRule(currentRuleTree, student, context)).map((student) => student.profileId)
  );
  const draftEligibleIds = new Set(
    students.filter((student) => evaluateEligibilityRule(draftRuleTree, student, context)).map((student) => student.profileId)
  );

  let removedStudents = 0;
  let addedStudents = 0;
  currentEligibleIds.forEach((id) => {
    if (!draftEligibleIds.has(id)) {
      removedStudents += 1;
    }
  });
  draftEligibleIds.forEach((id) => {
    if (!currentEligibleIds.has(id)) {
      addedStudents += 1;
    }
  });

  return {
    totalStudents: students.length,
    eligibleStudents: draftEligibleIds.size,
    removedStudents,
    addedStudents,
    currentRule: currentRuleTree,
    draftRule: draftRuleTree,
  };
}

export async function evaluateEligibilityResultForRole(
  actor: AppUser,
  input: {
    roleId: string;
    studentProfileId: string;
    draftRuleTree?: EligibilityRuleSet["ruleTree"] | null;
  }
): Promise<EligibilityResult> {
  const variables = await loadVariableMap(actor);
  const roleRule = input.draftRuleTree ?? (await resolveRoleRuleTree(input.roleId));
  assertValidRule(roleRule, { variables });
  const students = await loadEligibilityStudentRecords(actor.universityId);
  const student = students.find((item) => item.profileId === input.studentProfileId);

  if (!student) {
    throw AppError.notFound("Student profile not found for eligibility evaluation.");
  }

  return {
    eligible: evaluateEligibilityRule(roleRule, student, { variables }),
    evaluatedAt: new Date().toISOString(),
    ruleSetId: await resolveRoleRuleSetId(input.roleId),
    studentProfileId: student.profileId,
  };
}

export async function createEligibilityRuleSet(
  actor: AppUser,
  input: { roleId: string; name: string; description?: string; ruleTree: EligibilityRuleSet["ruleTree"] | null }
): Promise<EligibilityRuleSet> {
  const databases = getServerDatabases();
  const variables = await loadVariableMap(actor);
  assertValidRule(input.ruleTree, { variables });
  const now = new Date().toISOString();
  const result = await databases.createDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.ELIGIBILITY_RULES,
    ID.unique(),
    {
      universityId: actor.universityId,
      roleId: input.roleId,
      name: input.name,
      description: input.description ?? null,
      ruleTree: input.ruleTree,
      createdBy: actor.$id,
      createdAt: now,
      updatedAt: now,
    }
  );

  return docToEligibilityRuleSet(result);
}

export async function updateEligibilityRuleSet(
  actor: AppUser,
  ruleSetId: string,
  input: EligibilityRuleDraft
): Promise<EligibilityRuleSet> {
  const databases = getServerDatabases();
  const variables = await loadVariableMap(actor);
  assertValidRule(input.ruleTree, { variables });
  const result = await databases.updateDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.ELIGIBILITY_RULES,
    ruleSetId,
    {
      name: input.name,
      description: input.description ?? null,
      ruleTree: input.ruleTree,
      updatedAt: new Date().toISOString(),
    }
  );

  return docToEligibilityRuleSet(result);
}

export async function readEligibilityRuleSet(ruleSetId: string): Promise<EligibilityRuleSet | null> {
  const databases = getServerDatabases();
  try {
    const result = await databases.getDocument<Models.DefaultDocument>(
      DATABASE_ID,
      Collections.ELIGIBILITY_RULES,
      ruleSetId
    );
    return docToEligibilityRuleSet(result);
  } catch {
    return null;
  }
}

async function loadVariableMap(actor: AppUser): Promise<Map<string, EligibilityVariableDefinition>> {
  const context = await buildVariableContextForUniversity(actor);
  return context.variableMap;
}

async function resolveRoleRuleTree(roleId: string): Promise<EligibilityRuleSet["ruleTree"] | null> {
  const databases = getServerDatabases();
  const role = await databases.getDocument<Models.DefaultDocument>(DATABASE_ID, Collections.ROLES, roleId);
  const ruleSetId = (role.eligibilityRuleSetId as string | null) ?? undefined;
  if (!ruleSetId) {
    return null;
  }
  const ruleSet = await readEligibilityRuleSet(ruleSetId);
  return ruleSet?.ruleTree ?? null;
}

async function resolveRoleRuleSetId(roleId: string): Promise<string | undefined> {
  const databases = getServerDatabases();
  const role = await databases.getDocument<Models.DefaultDocument>(DATABASE_ID, Collections.ROLES, roleId);
  return (role.eligibilityRuleSetId as string | null) ?? undefined;
}

async function loadEligibilityStudentRecords(universityId: string): Promise<EligibilityStudentRecord[]> {
  const databases = getServerDatabases();
  const [profileResult, usersResult] = await Promise.all([
    databases.listDocuments<Models.DefaultDocument>(
      DATABASE_ID,
      Collections.STUDENT_PROFILES,
      [Query.equal("universityId", universityId), Query.limit(500)]
    ),
    databases.listDocuments<Models.DefaultDocument>(
      DATABASE_ID,
      Collections.USERS,
      [Query.equal("universityId", universityId), Query.equal("role", "STUDENT"), Query.limit(500)]
    ),
  ]);

  const usersById = new Map(
    usersResult.documents.map((doc) => [
      doc.$id,
      {
        name: String(doc.name),
        email: String(doc.email),
      },
    ])
  );

  return profileResult.documents.map((doc) => {
    const profile = docToStudentProfile(doc);
    const identity = usersById.get(profile.userId);
    const completion = calculateProfileCompletion({
      identity: {
        name: identity?.name ?? "",
        email: identity?.email ?? "",
        phone: profile.personalInfo.phone,
        dateOfBirth: profile.personalInfo.dateOfBirth,
      },
      academic: profile.academic,
      professional: profile.professional,
    });

    return {
      userId: profile.userId,
      profileId: profile.$id,
      universityId,
      values: {
        is_profile_complete: completion === 100,
        ...extractVariableValuesFromStudentProfile({
          ...profile,
          isProfileComplete: completion === 100,
        }),
      },
    };
  });
}

function assertValidRule(
  ruleTree: EligibilityRuleSet["ruleTree"] | null,
  context: { variables: Map<string, EligibilityVariableDefinition> }
): void {
  const validation = validateEligibilityRuleTree(ruleTree, context);
  if (!validation.valid) {
    throw AppError.validationError(validation.errors.join("; "));
  }
}

function docToEligibilityRuleSet(doc: Models.DefaultDocument): EligibilityRuleSet {
  return {
    $id: doc.$id,
    universityId: String(doc.universityId),
    roleId: (doc.roleId as string | null) ?? undefined,
    name: String(doc.name),
    description: (doc.description as string | null) ?? undefined,
    ruleTree: (doc.ruleTree as EligibilityRuleSet["ruleTree"]) ?? { type: "group", logic: "AND", children: [] },
    createdBy: String(doc.createdBy),
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

function docToStudentProfile(doc: Models.DefaultDocument): StudentProfile {
  return {
    $id: doc.$id,
    userId: String(doc.userId),
    universityId: String(doc.universityId),
    personalInfo: (doc.personalInfo as StudentProfile["personalInfo"]) ?? {},
    academic: (doc.academic as StudentProfile["academic"]) ?? {},
    professional: (doc.professional as StudentProfile["professional"]) ?? {
      previousCompanies: [],
      previousTitles: [],
      internships: [],
      certifications: [],
      skills: [],
      projects: [],
    },
    placement: (doc.placement as StudentProfile["placement"]) ?? {
      status: "NOT_PLACED",
      numberOfOffers: 0,
      placementHistory: [],
    },
    customFields: (doc.customFields as Record<string, unknown>) ?? {},
    isProfileComplete: Boolean(doc.isProfileComplete),
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}
