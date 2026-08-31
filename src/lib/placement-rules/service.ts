import { ID, Models, Query } from "node-appwrite";
import { Collections, DATABASE_ID } from "@/lib/appwrite/constants";
import { getServerDatabases } from "@/lib/appwrite/server";
import { createAuditLog } from "@/lib/audit/service";
import { AppError, isNotFoundError } from "@/lib/errors";
import { getStudentProfileForActor } from "@/lib/student-profile/service";
import type { AppUser, Application, ApplicationStatus, PlacementRound, PlacementRule, Role } from "@/types";
import type {
  CtcBasedRestrictionConfig,
  MaxActiveApplicationsConfig,
  MaxApplicationsPerCompanyConfig,
  MaxApplicationsPerStudentConfig,
  OfferBasedRestrictionConfig,
  PlacementRuleContext,
  PlacementRuleEvaluationResult,
  PlacementRuleInput,
  PlacementRuleViolation,
  RoundSpecificRestrictionConfig,
  SelectedStudentRestrictionConfig,
} from "./types";

const ACTIVE_APPLICATION_STATUSES: ApplicationStatus[] = [
  "APPLIED",
  "SHORTLISTED",
  "IN_ROUND",
  "SELECTED",
  "OFFERED",
  "ACCEPTED",
];

const NON_WITHDRAWN_STATUSES: ApplicationStatus[] = [
  "APPLIED",
  "SHORTLISTED",
  "REJECTED",
  "IN_ROUND",
  "SELECTED",
  "OFFERED",
  "ACCEPTED",
  "DECLINED",
];

export async function evaluatePlacementRulesForApplication(
  actor: AppUser,
  input: { roleId: string; studentUserId: string }
): Promise<PlacementRuleEvaluationResult> {
  const [studentProfile, role, rules] = await Promise.all([
    getStudentProfileForActor(actor, input.studentUserId),
    readRole(input.roleId),
    listActivePlacementRulesForUniversity(actor.universityId),
  ]);

  if (role.universityId !== actor.universityId || studentProfile.identity.universityId !== actor.universityId) {
    throw AppError.forbidden("You do not have access to evaluate these placement rules.");
  }

  const applications = await readApplicationsByStudent(studentProfile.profile.profileId);
  const roundIds = Array.from(new Set(applications.map((item) => item.currentRoundId).filter(isNonEmptyString)));
  const rounds = roundIds.length > 0 ? await readRounds(roundIds) : [];

  const context: PlacementRuleContext = {
    studentUserId: input.studentUserId,
    studentProfileId: studentProfile.profile.profileId,
    role,
  };

  const violations = rules.flatMap((rule) =>
    evaluateRule(rule, {
      applications,
      rounds,
      role,
      studentProfile,
      context,
    })
  );

  return {
    allowed: violations.length === 0,
    violations,
  };
}

export async function listPlacementRulesForAdmin(actor: AppUser): Promise<PlacementRule[]> {
  return listPlacementRulesForUniversity(actor.universityId);
}

export async function createPlacementRuleForAdmin(actor: AppUser, input: PlacementRuleInput): Promise<PlacementRule> {
  const payload = normalizePlacementRuleInput(input);
  const now = new Date().toISOString();
  const databases = getServerDatabases();
  const created = await databases.createDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.PLACEMENT_RULES,
    ID.unique(),
    {
      universityId: actor.universityId,
      name: payload.name,
      description: payload.description ?? null,
      ruleType: payload.ruleType,
      config: payload.config,
      isActive: payload.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    }
  );

  await createAuditLog(actor, {
    action: "placement_rule.created",
    entityType: "placement_rule",
    entityId: created.$id,
    newValue: {
      name: payload.name,
      ruleType: payload.ruleType,
      config: payload.config,
      isActive: payload.isActive ?? true,
    },
  });

  return docToPlacementRule(created);
}

export async function updatePlacementRuleForAdmin(
  actor: AppUser,
  ruleId: string,
  input: PlacementRuleInput
): Promise<PlacementRule> {
  const existing = await readPlacementRule(actor.universityId, ruleId);
  const payload = normalizePlacementRuleInput(input);
  const databases = getServerDatabases();
  const updated = await databases.updateDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.PLACEMENT_RULES,
    ruleId,
    {
      name: payload.name,
      description: payload.description ?? null,
      ruleType: payload.ruleType,
      config: payload.config,
      isActive: payload.isActive ?? true,
      updatedAt: new Date().toISOString(),
    }
  );

  await createAuditLog(actor, {
    action: "placement_rule.updated",
    entityType: "placement_rule",
    entityId: ruleId,
    previousValue: {
      name: existing.name,
      description: existing.description ?? null,
      ruleType: existing.ruleType,
      config: existing.config,
      isActive: existing.isActive,
    },
    newValue: {
      name: payload.name,
      description: payload.description ?? null,
      ruleType: payload.ruleType,
      config: payload.config,
      isActive: payload.isActive ?? true,
    },
  });

  return docToPlacementRule(updated);
}

export async function deletePlacementRuleForAdmin(actor: AppUser, ruleId: string): Promise<void> {
  const existing = await readPlacementRule(actor.universityId, ruleId);
  const databases = getServerDatabases();
  await databases.deleteDocument(DATABASE_ID, Collections.PLACEMENT_RULES, ruleId);

  await createAuditLog(actor, {
    action: "placement_rule.deleted",
    entityType: "placement_rule",
    entityId: ruleId,
    previousValue: {
      name: existing.name,
      description: existing.description ?? null,
      ruleType: existing.ruleType,
      config: existing.config,
      isActive: existing.isActive,
    },
  });
}

function evaluateRule(
  rule: PlacementRule,
  input: {
    applications: Application[];
    rounds: PlacementRound[];
    role: Role;
    studentProfile: Awaited<ReturnType<typeof getStudentProfileForActor>>;
    context: PlacementRuleContext;
  }
): PlacementRuleViolation[] {
  switch (rule.ruleType) {
    case "max_applications_per_student":
      return evaluateMaxApplicationsPerStudent(rule, input.applications);
    case "max_applications_per_company":
      return evaluateMaxApplicationsPerCompany(rule, input.applications, input.role.companyId);
    case "max_active_applications":
      return evaluateMaxActiveApplications(rule, input.applications);
    case "offer_based_restriction":
      return evaluateOfferRestriction(rule, input.studentProfile);
    case "ctc_based_restriction":
      return evaluateCtcRestriction(rule, input.role, input.studentProfile);
    case "selected_student_restriction":
      return evaluateSelectedStudentRestriction(rule, input.applications, input.role.companyId);
    case "round_specific_restriction":
      return evaluateRoundSpecificRestriction(rule, input.applications, input.rounds, input.role);
    case "custom":
      return [];
    default:
      return [];
  }
}

function evaluateMaxApplicationsPerStudent(rule: PlacementRule, applications: Application[]): PlacementRuleViolation[] {
  const config = normalizeMaxApplicationsPerStudentConfig(rule.config);
  const statuses = config.statuses ?? NON_WITHDRAWN_STATUSES;
  const count = applications.filter((item) => statuses.includes(item.status)).length;
  if (count < config.maxApplications) {
    return [];
  }
  return [
    violation(rule, `Student has reached the maximum of ${config.maxApplications} applications.`, {
      currentCount: count,
      maxApplications: config.maxApplications,
      statuses,
    }),
  ];
}

function evaluateMaxApplicationsPerCompany(
  rule: PlacementRule,
  applications: Application[],
  targetCompanyId: string
): PlacementRuleViolation[] {
  const config = normalizeMaxApplicationsPerCompanyConfig(rule.config);
  const statuses = config.statuses ?? ACTIVE_APPLICATION_STATUSES;
  const count = applications.filter(
    (item) => item.companyId === targetCompanyId && statuses.includes(item.status)
  ).length;
  if (count < config.maxApplications) {
    return [];
  }
  return [
    violation(rule, `Student has reached the maximum of ${config.maxApplications} applications for this company.`, {
      currentCount: count,
      maxApplications: config.maxApplications,
      statuses,
      companyId: targetCompanyId,
    }),
  ];
}

function evaluateMaxActiveApplications(rule: PlacementRule, applications: Application[]): PlacementRuleViolation[] {
  const config = normalizeMaxActiveApplicationsConfig(rule.config);
  const count = applications.filter((item) => ACTIVE_APPLICATION_STATUSES.includes(item.status)).length;
  if (count < config.maxActiveApplications) {
    return [];
  }
  return [
    violation(rule, `Student has reached the maximum of ${config.maxActiveApplications} active applications.`, {
      currentCount: count,
      maxActiveApplications: config.maxActiveApplications,
    }),
  ];
}

function evaluateOfferRestriction(
  rule: PlacementRule,
  studentProfile: Awaited<ReturnType<typeof getStudentProfileForActor>>
): PlacementRuleViolation[] {
  const config = normalizeOfferBasedRestrictionConfig(rule.config);
  const placement = studentProfile.profile.placement;
  const maxOffers = config.maxOffers ?? Number.MAX_SAFE_INTEGER;
  const blockedPlacementStatuses = config.blockedPlacementStatuses ?? [];
  const blockedOfferStatuses = config.blockedOfferStatuses ?? [];
  if (config.blockIfPlaced && placement.status === "PLACED") {
    return [violation(rule, "Student is already placed and cannot apply for additional roles.", { status: placement.status })];
  }
  if (placement.numberOfOffers >= maxOffers) {
    return [violation(rule, `Student has already reached the maximum of ${maxOffers} offers.`, { numberOfOffers: placement.numberOfOffers })];
  }
  if (blockedPlacementStatuses.includes(placement.status)) {
    return [violation(rule, `Student cannot apply while placement status is ${placement.status}.`, { status: placement.status })];
  }
  if (placement.offerStatus && blockedOfferStatuses.includes(placement.offerStatus)) {
    return [violation(rule, `Student cannot apply while offer status is ${placement.offerStatus}.`, { offerStatus: placement.offerStatus })];
  }
  return [];
}

function evaluateCtcRestriction(
  rule: PlacementRule,
  role: Role,
  studentProfile: Awaited<ReturnType<typeof getStudentProfileForActor>>
): PlacementRuleViolation[] {
  const config = normalizeCtcBasedRestrictionConfig(rule.config);
  const currentOfferCtc = studentProfile.profile.placement.currentOfferCtc ?? 0;
  if (!role.ctc) {
    return config.ignoreRolesWithoutCtc ? [violation(rule, "Role CTC is unavailable and cannot satisfy this restriction.", {})] : [];
  }
  if (config.triggerOnCurrentOfferCtcGte !== undefined && currentOfferCtc < config.triggerOnCurrentOfferCtcGte) {
    return [];
  }
  if (config.disallowRoleCtcBelow !== undefined && role.ctc < config.disallowRoleCtcBelow) {
    return [
      violation(
        rule,
        `Role CTC ${role.ctc} LPA is below the minimum allowed ${config.disallowRoleCtcBelow} LPA.`,
        { roleCtc: role.ctc, minimumAllowedCtc: config.disallowRoleCtcBelow, currentOfferCtc }
      ),
    ];
  }
  if (currentOfferCtc > 0 && config.minimumPercentAboveCurrentOffer !== undefined) {
    const minimumRequired = currentOfferCtc * (1 + config.minimumPercentAboveCurrentOffer / 100);
    if (role.ctc < minimumRequired) {
      return [
        violation(rule, `Role CTC must be at least ${minimumRequired} LPA based on the student's current offer.`, {
          roleCtc: role.ctc,
          currentOfferCtc,
          minimumRequired,
        }),
      ];
    }
  }
  if (currentOfferCtc > 0 && config.minimumAbsoluteIncreaseLpa !== undefined) {
    const minimumRequired = currentOfferCtc + config.minimumAbsoluteIncreaseLpa;
    if (role.ctc < minimumRequired) {
      return [
        violation(rule, `Role CTC must exceed the student's current offer by ${config.minimumAbsoluteIncreaseLpa} LPA.`, {
          roleCtc: role.ctc,
          currentOfferCtc,
          minimumRequired,
        }),
      ];
    }
  }
  return [];
}

function evaluateSelectedStudentRestriction(
  rule: PlacementRule,
  applications: Application[],
  targetCompanyId: string
): PlacementRuleViolation[] {
  const config = normalizeSelectedStudentRestrictionConfig(rule.config);
  const selectedStatuses = config.selectedStatuses ?? ["SELECTED", "OFFERED", "ACCEPTED"];
  if (!config.blockIfSelected) {
    return [];
  }
  const count = applications.filter((item) => {
    if (!selectedStatuses.includes(item.status)) {
      return false;
    }
    if (config.companyScope === "same_company") {
      return item.companyId === targetCompanyId;
    }
    return true;
  }).length;
  if (count === 0) {
    return [];
  }
  return [
    violation(rule, "Student has already been selected and cannot apply under this rule.", {
      matchingApplications: count,
      selectedStatuses,
      companyScope: config.companyScope,
    }),
  ];
}

function evaluateRoundSpecificRestriction(
  rule: PlacementRule,
  applications: Application[],
  rounds: PlacementRound[],
  targetRole: Role
): PlacementRuleViolation[] {
  const config = normalizeRoundSpecificRestrictionConfig(rule.config);
  const applicationStatuses = config.applicationStatuses ?? ["IN_ROUND", "SHORTLISTED", "SELECTED", "OFFERED", "ACCEPTED"];
  const blockedRoundTypes = config.blockedRoundTypes ?? [];
  const blockedRoundIds = config.blockedRoundIds ?? [];
  const roundMap = new Map(rounds.map((round) => [round.$id, round]));
  const matchingCount = applications.filter((application) => {
    if (!applicationStatuses.includes(application.status)) {
      return false;
    }
    if (config.scope === "same_company" && application.companyId !== targetRole.companyId) {
      return false;
    }
    if (config.scope === "same_role" && application.roleId !== targetRole.$id) {
      return false;
    }
    const roundId = application.currentRoundId;
    if (!roundId) {
      return false;
    }
    const round = roundMap.get(roundId);
    if (!round) {
      return false;
    }
    const roundTypeMatch =
      blockedRoundTypes.length === 0 || blockedRoundTypes.includes(round.type);
    const roundIdMatch = blockedRoundIds.length === 0 || blockedRoundIds.includes(round.$id);
    return roundTypeMatch && roundIdMatch;
  }).length;

  if (matchingCount === 0) {
    return [];
  }
  return [
    violation(rule, "Student is already participating in a restricted round and cannot apply.", {
      matchingApplications: matchingCount,
      blockedRoundTypes,
      blockedRoundIds,
      scope: config.scope,
    }),
  ];
}

function normalizePlacementRuleInput(input: PlacementRuleInput): PlacementRuleInput {
  const name = cleanRequiredString(input.name, "name", 1, 120);
  const description = cleanOptionalString(input.description, 240);
  validateRuleConfig(input.ruleType, input.config);
  return {
    name,
    description,
    ruleType: input.ruleType,
    config: input.config,
    isActive: input.isActive ?? true,
  };
}

function validateRuleConfig(ruleType: PlacementRule["ruleType"], config: Record<string, unknown>): void {
  switch (ruleType) {
    case "max_applications_per_student":
      normalizeMaxApplicationsPerStudentConfig(config);
      return;
    case "max_applications_per_company":
      normalizeMaxApplicationsPerCompanyConfig(config);
      return;
    case "max_active_applications":
      normalizeMaxActiveApplicationsConfig(config);
      return;
    case "offer_based_restriction":
      normalizeOfferBasedRestrictionConfig(config);
      return;
    case "ctc_based_restriction":
      normalizeCtcBasedRestrictionConfig(config);
      return;
    case "selected_student_restriction":
      normalizeSelectedStudentRestrictionConfig(config);
      return;
    case "round_specific_restriction":
      normalizeRoundSpecificRestrictionConfig(config);
      return;
    case "custom":
      return;
  }
}

function normalizeMaxApplicationsPerStudentConfig(config: Record<string, unknown>): MaxApplicationsPerStudentConfig {
  return {
    maxApplications: readPositiveInteger(config.maxApplications, "maxApplications"),
    statuses: normalizeStatuses(config.statuses, NON_WITHDRAWN_STATUSES),
  };
}

function normalizeMaxApplicationsPerCompanyConfig(config: Record<string, unknown>): MaxApplicationsPerCompanyConfig {
  return {
    maxApplications: readPositiveInteger(config.maxApplications, "maxApplications"),
    statuses: normalizeStatuses(config.statuses, ACTIVE_APPLICATION_STATUSES),
  };
}

function normalizeMaxActiveApplicationsConfig(config: Record<string, unknown>): MaxActiveApplicationsConfig {
  return {
    maxActiveApplications: readPositiveInteger(config.maxActiveApplications, "maxActiveApplications"),
  };
}

function normalizeOfferBasedRestrictionConfig(config: Record<string, unknown>): OfferBasedRestrictionConfig {
  return {
    blockIfPlaced: config.blockIfPlaced === undefined ? true : Boolean(config.blockIfPlaced),
    maxOffers: config.maxOffers === undefined ? Number.MAX_SAFE_INTEGER : readPositiveInteger(config.maxOffers, "maxOffers"),
    blockedPlacementStatuses: normalizePlacementStatuses(config.blockedPlacementStatuses),
    blockedOfferStatuses: normalizeStringArray(config.blockedOfferStatuses),
  };
}

function normalizeCtcBasedRestrictionConfig(config: Record<string, unknown>): CtcBasedRestrictionConfig {
  const normalized: CtcBasedRestrictionConfig = {
    ignoreRolesWithoutCtc: Boolean(config.ignoreRolesWithoutCtc),
  };
  if (config.triggerOnCurrentOfferCtcGte !== undefined) {
    normalized.triggerOnCurrentOfferCtcGte = readNonNegativeNumber(config.triggerOnCurrentOfferCtcGte, "triggerOnCurrentOfferCtcGte");
  }
  if (config.disallowRoleCtcBelow !== undefined) {
    normalized.disallowRoleCtcBelow = readNonNegativeNumber(config.disallowRoleCtcBelow, "disallowRoleCtcBelow");
  }
  if (config.minimumPercentAboveCurrentOffer !== undefined) {
    normalized.minimumPercentAboveCurrentOffer = readNonNegativeNumber(
      config.minimumPercentAboveCurrentOffer,
      "minimumPercentAboveCurrentOffer"
    );
  }
  if (config.minimumAbsoluteIncreaseLpa !== undefined) {
    normalized.minimumAbsoluteIncreaseLpa = readNonNegativeNumber(
      config.minimumAbsoluteIncreaseLpa,
      "minimumAbsoluteIncreaseLpa"
    );
  }
  if (
    normalized.disallowRoleCtcBelow === undefined &&
    normalized.minimumPercentAboveCurrentOffer === undefined &&
    normalized.minimumAbsoluteIncreaseLpa === undefined
  ) {
    throw AppError.validationError("ctc_based_restriction requires at least one CTC threshold.");
  }
  return normalized;
}

function normalizeSelectedStudentRestrictionConfig(config: Record<string, unknown>): SelectedStudentRestrictionConfig {
  const companyScope = config.companyScope;
  if (companyScope !== undefined && companyScope !== "any" && companyScope !== "same_company") {
    throw AppError.validationError("companyScope must be 'any' or 'same_company'.");
  }
  return {
    blockIfSelected: config.blockIfSelected === undefined ? true : Boolean(config.blockIfSelected),
    selectedStatuses: normalizeStatuses(config.selectedStatuses, ["SELECTED", "OFFERED", "ACCEPTED"]),
    companyScope: companyScope ?? "any",
  };
}

function normalizeRoundSpecificRestrictionConfig(config: Record<string, unknown>): RoundSpecificRestrictionConfig {
  const scope = config.scope;
  if (scope !== undefined && scope !== "any" && scope !== "same_company" && scope !== "same_role") {
    throw AppError.validationError("scope must be 'any', 'same_company', or 'same_role'.");
  }
  const blockedRoundTypes = normalizeRoundTypes(config.blockedRoundTypes);
  const blockedRoundIds = normalizeStringArray(config.blockedRoundIds);
  if (blockedRoundTypes.length === 0 && blockedRoundIds.length === 0) {
    throw AppError.validationError("round_specific_restriction requires blockedRoundTypes or blockedRoundIds.");
  }
  return {
    blockedRoundTypes,
    blockedRoundIds,
    applicationStatuses: normalizeStatuses(config.applicationStatuses, ["IN_ROUND", "SHORTLISTED", "SELECTED", "OFFERED", "ACCEPTED"]),
    scope: scope ?? "any",
  };
}

async function listPlacementRulesForUniversity(universityId: string): Promise<PlacementRule[]> {
  const databases = getServerDatabases();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.PLACEMENT_RULES,
    [Query.equal("universityId", universityId), Query.limit(100)]
  );
  return result.documents.map(docToPlacementRule);
}

async function listActivePlacementRulesForUniversity(universityId: string): Promise<PlacementRule[]> {
  const rules = await listPlacementRulesForUniversity(universityId);
  return rules.filter((rule) => rule.isActive);
}

async function readPlacementRule(universityId: string, ruleId: string): Promise<PlacementRule> {
  const databases = getServerDatabases();
  try {
    const doc = await databases.getDocument<Models.DefaultDocument>(DATABASE_ID, Collections.PLACEMENT_RULES, ruleId);
    const rule = docToPlacementRule(doc);
    if (rule.universityId !== universityId) {
      throw AppError.notFound("Placement rule not found.");
    }
    return rule;
  } catch (error) {
    if (isNotFoundError(error)) {
      throw AppError.notFound("Placement rule not found.");
    }
    throw error;
  }
}

async function readApplicationsByStudent(studentId: string): Promise<Application[]> {
  const databases = getServerDatabases();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.APPLICATIONS,
    [Query.equal("studentId", studentId), Query.limit(200)]
  );
  return result.documents.map(docToApplication);
}

async function readRounds(roundIds: string[]): Promise<PlacementRound[]> {
  const databases = getServerDatabases();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.PLACEMENT_ROUNDS,
    [Query.equal("$id", roundIds), Query.limit(Math.max(roundIds.length, 1))]
  );
  return result.documents.map(docToPlacementRound);
}

async function readRole(roleId: string): Promise<Role> {
  const databases = getServerDatabases();
  try {
    const doc = await databases.getDocument<Models.DefaultDocument>(DATABASE_ID, Collections.ROLES, roleId);
    return {
      $id: doc.$id,
      companyId: String(doc.companyId),
      universityId: String(doc.universityId),
      title: String(doc.title),
      jdText: cleanMaybeString(doc.jdText),
      jdAttachmentId: cleanMaybeString(doc.jdAttachmentId),
      location: cleanMaybeString(doc.location),
      workMode: (doc.workMode as Role["workMode"] | null) ?? undefined,
      employmentType: (doc.employmentType as Role["employmentType"] | null) ?? undefined,
      ctc: typeof doc.ctc === "number" ? doc.ctc : undefined,
      fixedCtc: typeof doc.fixedCtc === "number" ? doc.fixedCtc : undefined,
      variableCtc: typeof doc.variableCtc === "number" ? doc.variableCtc : undefined,
      joiningDate: cleanMaybeString(doc.joiningDate),
      experienceRequirementMonths: typeof doc.experienceRequirementMonths === "number" ? doc.experienceRequirementMonths : undefined,
      numberOfOpenings: typeof doc.numberOfOpenings === "number" ? doc.numberOfOpenings : undefined,
      applicationDeadline: cleanMaybeString(doc.applicationDeadline),
      selectionProcessDescription: cleanMaybeString(doc.selectionProcessDescription),
      eligibilityRuleSetId: cleanMaybeString(doc.eligibilityRuleSetId),
      requiredSkills: Array.isArray(doc.requiredSkills) ? (doc.requiredSkills as string[]) : [],
      requiredQualifications: Array.isArray(doc.requiredQualifications) ? (doc.requiredQualifications as string[]) : [],
      status: doc.status as Role["status"],
      createdAt: (doc.createdAt as string) ?? doc.$createdAt,
      updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      throw AppError.notFound("Role not found.");
    }
    throw error;
  }
}

function docToApplication(doc: Models.DefaultDocument): Application {
  return {
    $id: doc.$id,
    studentId: String(doc.studentId),
    roleId: String(doc.roleId),
    companyId: String(doc.companyId),
    universityId: String(doc.universityId),
    status: doc.status as ApplicationStatus,
    currentRoundId: cleanMaybeString(doc.currentRoundId),
    appliedAt: String(doc.appliedAt ?? doc.$createdAt),
    withdrawnAt: cleanMaybeString(doc.withdrawnAt),
    lastStatusChangedAt: String(doc.lastStatusChangedAt ?? doc.$updatedAt),
    notes: cleanMaybeString(doc.notes),
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

function docToPlacementRound(doc: Models.DefaultDocument): PlacementRound {
  return {
    $id: doc.$id,
    roleId: String(doc.roleId),
    universityId: String(doc.universityId),
    name: String(doc.name),
    type: doc.type as PlacementRound["type"],
    description: cleanMaybeString(doc.description),
    instructions: cleanMaybeString(doc.instructions),
    startTime: cleanMaybeString(doc.startTime),
    endTime: cleanMaybeString(doc.endTime),
    location: cleanMaybeString(doc.location),
    meetingLink: cleanMaybeString(doc.meetingLink),
    capacity: typeof doc.capacity === "number" ? doc.capacity : undefined,
    evaluators: Array.isArray(doc.evaluators) ? (doc.evaluators as string[]) : [],
    status: doc.status as PlacementRound["status"],
    sequence: Number(doc.sequence ?? 0),
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

function docToPlacementRule(doc: Models.DefaultDocument): PlacementRule {
  return {
    $id: doc.$id,
    universityId: String(doc.universityId),
    name: String(doc.name),
    description: cleanMaybeString(doc.description),
    ruleType: doc.ruleType as PlacementRule["ruleType"],
    config: (doc.config as Record<string, unknown>) ?? {},
    isActive: Boolean(doc.isActive),
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

function normalizeStatuses(value: unknown, defaults: ApplicationStatus[]): ApplicationStatus[] {
  if (value === undefined) {
    return defaults;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw AppError.validationError("statuses must be an array of application statuses.");
  }
  return value as ApplicationStatus[];
}

function normalizePlacementStatuses(value: unknown): Array<"NOT_PLACED" | "PLACED" | "OPTED_OUT"> {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => item !== "NOT_PLACED" && item !== "PLACED" && item !== "OPTED_OUT")) {
    throw AppError.validationError("blockedPlacementStatuses must be valid placement statuses.");
  }
  return value as Array<"NOT_PLACED" | "PLACED" | "OPTED_OUT">;
}

function normalizeRoundTypes(value: unknown): PlacementRound["type"][] {
  if (value === undefined) {
    return [];
  }
  const allowed: PlacementRound["type"][] = [
    "resume_shortlist",
    "online_assessment",
    "technical_interview",
    "managerial_interview",
    "hr_interview",
    "group_discussion",
    "other",
  ];
  if (!Array.isArray(value) || value.some((item) => !allowed.includes(item as PlacementRound["type"]))) {
    throw AppError.validationError("blockedRoundTypes must be valid round types.");
  }
  return value as PlacementRound["type"][];
}

function normalizeStringArray(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw AppError.validationError("Expected a non-empty string array.");
  }
  return value.map((item) => String(item).trim());
}

function readPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw AppError.validationError(`${field} must be a positive integer.`);
  }
  return value;
}

function readNonNegativeNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw AppError.validationError(`${field} must be a non-negative number.`);
  }
  return value;
}

function cleanRequiredString(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") {
    throw AppError.validationError(`${field} must be a string.`);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw AppError.validationError(`${field} must be between ${min} and ${max} characters.`);
  }
  return normalized;
}

function cleanOptionalString(value: unknown, max: number): string | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw AppError.validationError("description must be a string.");
  }
  const normalized = value.trim();
  if (normalized.length > max) {
    throw AppError.validationError(`description must be at most ${max} characters.`);
  }
  return normalized || undefined;
}

function cleanMaybeString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function violation(rule: PlacementRule, message: string, details: Record<string, unknown>): PlacementRuleViolation {
  return {
    ruleId: rule.$id,
    ruleName: rule.name,
    ruleType: rule.ruleType,
    message,
    details,
  };
}
