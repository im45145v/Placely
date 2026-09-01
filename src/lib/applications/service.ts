import { createHash } from "node:crypto";
import { ID, Models, Query } from "node-appwrite";
import { USER_ROLES } from "@/lib/auth/roles";
import { Collections, DATABASE_ID } from "@/lib/appwrite/constants";
import { createServerServices } from "@/lib/appwrite/server";
import { createAuditLog } from "@/lib/audit/service";
import { getRoleDetailForStudent } from "@/lib/companies/service";
import { evaluateEligibilityRule, validateEligibilityRuleTree } from "@/lib/eligibility/engine";
import { evaluateEligibilityResultForRole } from "@/lib/eligibility/service";
import { AppError, isNotFoundError } from "@/lib/errors";
import { dispatchNotificationEvent } from "@/lib/notifications/service";
import { evaluatePlacementRulesForApplication } from "@/lib/placement-rules/service";
import { getStudentProfileForActor } from "@/lib/student-profile/service";
import { getServerEnv } from "@/lib/validation/env";
import { signFunctionPayload } from "@/lib/security/function-signing";
import { buildVariableContextForUniversity, extractVariableValuesFromStudentProfile } from "@/lib/variables/service";
import type { VariableDefinition } from "@/lib/variables/types";
import type {
  AppUser,
  Application,
  ApplicationStatus,
  BulkOperation,
  Company,
  InterviewScheduleStatus,
  PlacementRound,
  Role,
  RoundOutcome,
  RoundParticipant,
  RoundResult,
  StudentProfile,
} from "@/types";
import type {
  ApplicationDetail,
  ApplicationRoundWorkflow,
  ApplicationCsvImportRow,
  ApplicationFilters,
  ApplicationTimelineEntry,
  BulkActionResult,
  BulkOperationSummary,
  PaginatedApplications,
} from "./types";

const PAGE_SIZE = 10;
const STUDENT_WITHDRAWABLE_STATUSES: ApplicationStatus[] = ["APPLIED", "SHORTLISTED"];
const DIRECT_BULK_LIMIT = 25;

export async function createApplicationForStudent(actor: AppUser, roleId: string): Promise<ApplicationDetail> {
  assertStudent(actor);
  return createApplicationRecord(actor, { roleId, studentUserId: actor.$id });
}

export async function createApplicationForAdmin(
  actor: AppUser,
  input: {
    roleId: string;
    studentUserId: string;
    overrideReason?: string;
  }
): Promise<ApplicationDetail> {
  assertAdmin(actor);
  return createApplicationRecord(actor, input);
}

async function createApplicationRecord(
  actor: AppUser,
  input: {
    roleId: string;
    studentUserId: string;
    overrideReason?: string;
  }
): Promise<ApplicationDetail> {
  const { databases } = createServerServices();
  const studentProfile = await getStudentProfileForActor(actor, input.studentUserId);
  const roleDetail = await getRoleDetailForStudent(actor, input.roleId);
  await assertRoleOpenForApplications(roleDetail);
  await assertStudentEligibility(actor, input.roleId, studentProfile.profile.profileId);

  const placementRuleEvaluation = await evaluatePlacementRulesForApplication(actor, {
    roleId: input.roleId,
    studentUserId: input.studentUserId,
  });
  const overrideReason = cleanOptional(input.overrideReason);
  if (!placementRuleEvaluation.allowed) {
    if (!overrideReason || actor.role === USER_ROLES.STUDENT) {
      throw AppError.forbidden("Application blocked by placement restrictions.");
    }
  }

  const existing = await readApplicationByStudentAndRole(studentProfile.profile.profileId, input.roleId);
  if (existing) {
    if (existing.status !== "WITHDRAWN") {
      return actor.role === USER_ROLES.STUDENT
        ? getStudentApplicationDetail(actor, existing.$id)
        : getAdminApplicationDetail(actor, existing.$id);
    }
    throw AppError.conflict("You have already applied to this role and withdrawn the application.");
  }

  const now = new Date().toISOString();
  const applicationId = createDeterministicApplicationId(studentProfile.profile.profileId, input.roleId);

  try {
    await databases.createDocument<Models.DefaultDocument>(
      DATABASE_ID,
      Collections.APPLICATIONS,
      applicationId,
      {
        studentId: studentProfile.profile.profileId,
        roleId: roleDetail.$id,
        companyId: roleDetail.company.$id,
        universityId: actor.universityId,
        status: "APPLIED",
        currentRoundId: null,
        appliedAt: now,
        withdrawnAt: null,
        lastStatusChangedAt: now,
        notes: null,
        createdAt: now,
        updatedAt: now,
      }
    );
  } catch (error) {
    if (isConflictError(error)) {
      const concurrent = await readApplicationByStudentAndRole(studentProfile.profile.profileId, input.roleId);
      if (concurrent) {
        return getStudentApplicationDetail(actor, concurrent.$id);
      }
    }
    throw error;
  }

  await createAuditLog(actor, {
    action: "application.created",
    entityType: "application",
    entityId: applicationId,
    newValue: {
      status: "APPLIED",
      roleId: input.roleId,
      studentId: studentProfile.profile.profileId,
      createdByRole: actor.role,
    },
  });

  if (overrideReason) {
    await createAuditLog(actor, {
      action: "application.restriction_overridden",
      entityType: "application",
      entityId: applicationId,
      newValue: {
        studentUserId: input.studentUserId,
        studentId: studentProfile.profile.profileId,
        roleId: input.roleId,
        overrideReason,
        violations: placementRuleEvaluation.violations,
      },
    });
  }

  await dispatchNotificationEvent({
    type: "APPLICATION_SUBMITTED",
    universityId: actor.universityId,
    recipientUserIds: [input.studentUserId],
    entityId: applicationId,
    entityType: "application",
    dedupeKey: `application-submitted:${applicationId}`,
    variables: {
      student_name: studentProfile.identity.name,
      company_name: roleDetail.company.name,
      role_name: roleDetail.title,
    },
  });

  return actor.role === USER_ROLES.STUDENT
    ? getStudentApplicationDetail(actor, applicationId)
    : getAdminApplicationDetail(actor, applicationId);
}

export async function listApplicationsForAdmin(
  actor: AppUser,
  filters: ApplicationFilters
): Promise<PaginatedApplications<ApplicationDetail>> {
  assertAdmin(actor);
  const { databases } = createServerServices();
  const queries =
    actor.role === USER_ROLES.SUPER_ADMIN
      ? [Query.limit(200)]
      : [Query.equal("universityId", actor.universityId), Query.limit(200)];
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.APPLICATIONS,
    queries
  );
  const applications = result.documents.map(docToApplication);
  return paginateAndHydrateApplications(actor, applications, filters, true);
}

export async function listPlacementRoundsForAdmin(actor: AppUser, roleId?: string): Promise<PlacementRound[]> {
  assertAdmin(actor);
  const { databases } = createServerServices();
  const queries = actor.role === USER_ROLES.SUPER_ADMIN
    ? [Query.limit(200)]
    : [Query.equal("universityId", actor.universityId), Query.limit(200)];

  if (roleId) {
    queries.splice(queries.length - 1, 0, Query.equal("roleId", roleId));
  }

  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.PLACEMENT_ROUNDS,
    queries
  );

  return result.documents
    .map(docToPlacementRound)
    .sort((left, right) => left.sequence - right.sequence || left.name.localeCompare(right.name));
}

export async function createPlacementRoundForAdmin(
  actor: AppUser,
  roleId: string,
  input: {
    name: string;
    type: PlacementRound["type"];
    description?: string;
    instructions?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    meetingLink?: string;
    status?: PlacementRound["status"];
  }
): Promise<PlacementRound> {
  assertAdmin(actor);
  const role = await readRole(roleId);
  assertUniversityScope(actor, role.universityId);
  const rounds = await listPlacementRoundsForAdmin(actor, roleId);
  const now = new Date().toISOString();
  const { databases } = createServerServices();
  const doc = await databases.createDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.PLACEMENT_ROUNDS,
    ID.unique(),
    {
      roleId,
      universityId: role.universityId,
      name: input.name.trim(),
      type: input.type,
      description: cleanOptional(input.description) ?? null,
      instructions: cleanOptional(input.instructions) ?? null,
      startTime: cleanOptional(input.startTime) ?? null,
      endTime: cleanOptional(input.endTime) ?? null,
      location: cleanOptional(input.location) ?? null,
      meetingLink: cleanOptional(input.meetingLink) ?? null,
      capacity: null,
      evaluators: [],
      status: input.status ?? "scheduled",
      sequence: rounds.length + 1,
      createdAt: now,
      updatedAt: now,
    }
  );

  await createAuditLog(actor, {
    action: "round.created",
    entityType: "placement_round",
    entityId: doc.$id,
    newValue: { roleId, sequence: rounds.length + 1, name: input.name.trim(), type: input.type },
  });

  return docToPlacementRound(doc);
}

export async function updatePlacementRoundForAdmin(
  actor: AppUser,
  roundId: string,
  input: Partial<{
    name: string;
    type: PlacementRound["type"];
    description: string;
    instructions: string;
    startTime: string;
    endTime: string;
    location: string;
    meetingLink: string;
    status: PlacementRound["status"];
  }>
): Promise<PlacementRound> {
  assertAdmin(actor);
  const round = await readPlacementRound(roundId);
  assertUniversityScope(actor, round.universityId);
  const now = new Date().toISOString();
  const { databases } = createServerServices();
  const doc = await databases.updateDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.PLACEMENT_ROUNDS,
    roundId,
    {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.description !== undefined ? { description: cleanOptional(input.description) ?? null } : {}),
      ...(input.instructions !== undefined ? { instructions: cleanOptional(input.instructions) ?? null } : {}),
      ...(input.startTime !== undefined ? { startTime: cleanOptional(input.startTime) ?? null } : {}),
      ...(input.endTime !== undefined ? { endTime: cleanOptional(input.endTime) ?? null } : {}),
      ...(input.location !== undefined ? { location: cleanOptional(input.location) ?? null } : {}),
      ...(input.meetingLink !== undefined ? { meetingLink: cleanOptional(input.meetingLink) ?? null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: now,
    }
  );

  await createAuditLog(actor, {
    action: "round.updated",
    entityType: "placement_round",
    entityId: roundId,
    previousValue: { ...round },
    newValue: { ...docToPlacementRound(doc) },
  });

  if (
    input.startTime !== undefined ||
    input.endTime !== undefined ||
    input.location !== undefined ||
    input.meetingLink !== undefined ||
    input.instructions !== undefined ||
    input.status !== undefined ||
    input.name !== undefined
  ) {
    await dispatchRoundNotification(roundId, "ROUND_UPDATED", `round-updated:${roundId}:${now}`);
  }

  return docToPlacementRound(doc);
}

export async function deletePlacementRoundForAdmin(actor: AppUser, roundId: string): Promise<void> {
  assertAdmin(actor);
  const round = await readPlacementRound(roundId);
  assertUniversityScope(actor, round.universityId);
  const { databases } = createServerServices();
  const participants = await readRoundParticipantsByRound(roundId);
  const results = await readRoundResultsByRound(roundId);

  for (const participant of participants) {
    await databases.deleteDocument(DATABASE_ID, Collections.ROUND_PARTICIPANTS, participant.$id);
  }
  for (const result of results) {
    await databases.deleteDocument(DATABASE_ID, Collections.RESULTS, result.$id);
  }
  await databases.deleteDocument(DATABASE_ID, Collections.PLACEMENT_ROUNDS, roundId);
  await normalizeRoundSequences(actor, round.roleId);

  await createAuditLog(actor, {
    action: "round.deleted",
    entityType: "placement_round",
    entityId: roundId,
    previousValue: { ...round },
  });
}

export async function reorderPlacementRoundsForAdmin(
  actor: AppUser,
  roleId: string,
  orderedRoundIds: string[]
): Promise<PlacementRound[]> {
  assertAdmin(actor);
  const rounds = await listPlacementRoundsForAdmin(actor, roleId);
  if (rounds.length !== orderedRoundIds.length) {
    throw AppError.validationError("Round reorder payload is incomplete.");
  }

  const roundIds = new Set(rounds.map((round) => round.$id));
  if (orderedRoundIds.some((roundId) => !roundIds.has(roundId))) {
    throw AppError.validationError("Round reorder payload contains invalid IDs.");
  }

  const { databases } = createServerServices();
  const now = new Date().toISOString();
  await Promise.all(orderedRoundIds.map((roundId, index) =>
    databases.updateDocument(DATABASE_ID, Collections.PLACEMENT_ROUNDS, roundId, {
      sequence: index + 1,
      updatedAt: now,
    })
  ));

  await createAuditLog(actor, {
    action: "round.reordered",
    entityType: "role",
    entityId: roleId,
    newValue: { orderedRoundIds },
  });

  return listPlacementRoundsForAdmin(actor, roleId);
}

export async function listApplicationsForStudent(
  actor: AppUser,
  filters: ApplicationFilters
): Promise<PaginatedApplications<ApplicationDetail>> {
  assertStudent(actor);
  const studentProfile = await getStudentProfileForActor(actor);
  const applications = await readApplicationsByStudent(studentProfile.profile.profileId);
  return paginateAndHydrateApplications(actor, applications, filters, false);
}

export async function getStudentApplicationDetail(actor: AppUser, applicationId: string): Promise<ApplicationDetail> {
  assertStudent(actor);
  const studentProfile = await getStudentProfileForActor(actor);
  const application = await readApplication(applicationId);

  if (application.studentId !== studentProfile.profile.profileId || application.universityId !== actor.universityId) {
    throw AppError.notFound("Application not found.");
  }

  return hydrateApplicationDetail(application);
}

export async function withdrawApplicationForStudent(actor: AppUser, applicationId: string): Promise<ApplicationDetail> {
  assertStudent(actor);
  const studentProfile = await getStudentProfileForActor(actor);
  const application = await readApplication(applicationId);

  if (application.studentId !== studentProfile.profile.profileId || application.universityId !== actor.universityId) {
    throw AppError.notFound("Application not found.");
  }
  if (!STUDENT_WITHDRAWABLE_STATUSES.includes(application.status)) {
    throw AppError.validationError("This application can no longer be withdrawn.");
  }

  const now = new Date().toISOString();
  const { databases } = createServerServices();
  await databases.updateDocument(
    DATABASE_ID,
    Collections.APPLICATIONS,
    applicationId,
    {
      status: "WITHDRAWN",
      withdrawnAt: now,
      lastStatusChangedAt: now,
      updatedAt: now,
    }
  );

  await createAuditLog(actor, {
    action: "application.withdrawn",
    entityType: "application",
    entityId: applicationId,
    previousValue: { status: application.status },
    newValue: { status: "WITHDRAWN" },
  });

  return getStudentApplicationDetail(actor, applicationId);
}

export async function getAdminApplicationDetail(actor: AppUser, applicationId: string): Promise<ApplicationDetail> {
  assertAdmin(actor);
  const application = await readApplication(applicationId);
  assertUniversityScope(actor, application.universityId);
  return hydrateApplicationDetail(application);
}

export async function shortlistApplicationForAdmin(
  actor: AppUser,
  applicationId: string,
  notes?: string
): Promise<ApplicationDetail> {
  return updateApplicationStatusForAdmin(actor, applicationId, "SHORTLISTED", notes, "application.shortlisted");
}

export async function rejectApplicationForAdmin(
  actor: AppUser,
  applicationId: string,
  notes?: string
): Promise<ApplicationDetail> {
  return updateApplicationStatusForAdmin(actor, applicationId, "REJECTED", notes, "application.rejected");
}

export async function bulkShortlistApplicationsForAdmin(actor: AppUser, applicationIds: string[], notes?: string) {
  return Promise.all(applicationIds.map((applicationId) => shortlistApplicationForAdmin(actor, applicationId, notes)));
}

export async function bulkRejectApplicationsForAdmin(actor: AppUser, applicationIds: string[], notes?: string) {
  return Promise.all(applicationIds.map((applicationId) => rejectApplicationForAdmin(actor, applicationId, notes)));
}

export async function moveApplicationToRoundForAdmin(
  actor: AppUser,
  applicationId: string,
  roundId: string,
  notes?: string
): Promise<ApplicationDetail> {
  assertAdmin(actor);
  const application = await readApplication(applicationId);
  assertUniversityScope(actor, application.universityId);
  const round = await readPlacementRound(roundId);
  if (round.roleId !== application.roleId) {
    throw AppError.validationError("Round does not belong to this role.");
  }

  const { databases } = createServerServices();
  const now = new Date().toISOString();
  const resolvedNotes = cleanOptional(notes) ?? application.notes ?? null;

  await ensureRoundParticipant(roundId, application);
  await databases.updateDocument(
    DATABASE_ID,
    Collections.APPLICATIONS,
    applicationId,
    {
      status: "IN_ROUND",
      currentRoundId: roundId,
      notes: resolvedNotes,
      lastStatusChangedAt: now,
      updatedAt: now,
    }
  );

  await createAuditLog(actor, {
    action: "application.moved_to_round",
    entityType: "application",
    entityId: applicationId,
    previousValue: {
      status: application.status,
      currentRoundId: application.currentRoundId ?? null,
      notes: application.notes ?? null,
    },
    newValue: {
      status: "IN_ROUND",
      currentRoundId: roundId,
      notes: resolvedNotes,
    },
  });

  return getAdminApplicationDetail(actor, applicationId);
}

export async function updateRoundParticipantForAdmin(
  actor: AppUser,
  participantId: string,
  input: Partial<{
    scheduledStart: string;
    scheduledEnd: string;
    slotLabel: string;
    room: string;
    location: string;
    meetingLink: string;
    scheduleTimezone: string;
    scheduleStatus: InterviewScheduleStatus;
    cancellationReason: string;
    instructions: string;
    interviewerIds: string[];
    score: number;
    notes: string;
    outcome: RoundOutcome;
    feedback: string;
    publishResult: boolean;
  }>
): Promise<ApplicationDetail> {
  assertAdmin(actor);
  const participant = await readRoundParticipant(participantId);
  const application = await readApplication(participant.applicationId);
  assertUniversityScope(actor, application.universityId);
  const now = new Date().toISOString();
  const { databases } = createServerServices();
  const normalizedSchedule = normalizeScheduleInput(participant, input);

  if (normalizedSchedule.hasSchedulingChange && normalizedSchedule.scheduledStart && normalizedSchedule.scheduledEnd) {
    await assertNoScheduleClash(actor, {
      participantId,
      studentId: participant.studentId,
      roundId: participant.roundId,
      scheduledStart: normalizedSchedule.scheduledStart,
      scheduledEnd: normalizedSchedule.scheduledEnd,
      interviewerIds: normalizedSchedule.interviewerIds,
      room: normalizedSchedule.room,
      scheduleStatus: normalizedSchedule.scheduleStatus,
    });
  }

  await databases.updateDocument(
    DATABASE_ID,
    Collections.ROUND_PARTICIPANTS,
    participantId,
    {
      ...(input.scheduledStart !== undefined ? { scheduledStart: normalizedSchedule.scheduledStart ?? null } : {}),
      ...(input.scheduledEnd !== undefined ? { scheduledEnd: normalizedSchedule.scheduledEnd ?? null } : {}),
      ...(input.slotLabel !== undefined ? { slotLabel: normalizedSchedule.slotLabel ?? null } : {}),
      ...(input.room !== undefined ? { room: normalizedSchedule.room ?? null } : {}),
      ...(input.location !== undefined ? { location: cleanOptional(input.location) ?? null } : {}),
      ...(input.meetingLink !== undefined ? { meetingLink: cleanOptional(input.meetingLink) ?? null } : {}),
      ...(input.scheduleTimezone !== undefined ? { scheduleTimezone: normalizedSchedule.scheduleTimezone ?? null } : {}),
      ...(input.scheduleStatus !== undefined ? { scheduleStatus: normalizedSchedule.scheduleStatus } : {}),
      ...(input.cancellationReason !== undefined ? { cancellationReason: normalizedSchedule.cancellationReason ?? null } : {}),
      ...(input.instructions !== undefined ? { instructions: cleanOptional(input.instructions) ?? null } : {}),
      ...(input.interviewerIds !== undefined ? { interviewerIds: normalizedSchedule.interviewerIds } : {}),
      ...(input.score !== undefined ? { score: input.score } : {}),
      ...(input.notes !== undefined ? { notes: cleanOptional(input.notes) ?? null } : {}),
      ...(input.outcome !== undefined ? { passed: input.outcome === "PASSED" || input.outcome === "SELECTED" } : {}),
      ...(input.publishResult !== undefined ? {
        resultPublished: input.publishResult,
        publishedAt: input.publishResult ? now : null,
      } : {}),
      ...(normalizedSchedule.hasSchedulingChange ? { lastScheduledAt: now } : {}),
      updatedAt: now,
    }
  );

  if (input.outcome) {
    await upsertRoundResult(actor, participant, application, {
      outcome: input.outcome,
      score: input.score,
      feedback: input.feedback,
      publishedAt: input.publishResult ? now : undefined,
    });
  }

  await createAuditLog(actor, {
    action: "round_participant.updated",
    entityType: "round_participant",
    entityId: participantId,
    previousValue: { ...participant },
    newValue: { ...input },
  });

  const schedulingChanged =
    input.scheduledStart !== undefined ||
    input.scheduledEnd !== undefined ||
    input.slotLabel !== undefined ||
    input.room !== undefined ||
    input.location !== undefined ||
    input.meetingLink !== undefined ||
    input.scheduleTimezone !== undefined ||
    input.scheduleStatus !== undefined ||
    input.cancellationReason !== undefined ||
    input.instructions !== undefined ||
    input.interviewerIds !== undefined;
  if (schedulingChanged) {
    await dispatchRoundNotification(
      participant.roundId,
      participant.scheduledStart || participant.scheduledEnd ? "ROUND_UPDATED" : "ROUND_SCHEDULED",
      `participant-schedule:${participantId}:${now}`
    );
  }
  if (input.publishResult) {
    const detail = await getAdminApplicationDetail(actor, application.$id);
    const currentRound = detail.workflow.find((item) => item.round.$id === participant.roundId)?.round;
    await dispatchNotificationEvent({
      type: "RESULT_PUBLISHED",
      universityId: detail.universityId,
      recipientUserIds: [detail.student.userId],
      entityId: detail.$id,
      entityType: "application",
      dedupeKey: `result-published:${participant.roundId}:${detail.$id}:${now}`,
      variables: {
        student_name: detail.student.name,
        company_name: detail.company.name,
        role_name: detail.role.title,
        round_name: currentRound?.name ?? "Current round",
      },
    });
  }

  return getAdminApplicationDetail(actor, application.$id);
}

export async function bulkScheduleRoundParticipantsForAdmin(
  actor: AppUser,
  roundId: string,
  input: {
    participantIds: string[];
    slots: Array<{
      scheduledStart: string;
      scheduledEnd: string;
      slotLabel?: string;
      room?: string;
      location?: string;
      meetingLink?: string;
      interviewerIds?: string[];
      instructions?: string;
      scheduleTimezone?: string;
    }>;
  }
): Promise<ApplicationDetail[]> {
  assertAdmin(actor);
  const round = await readPlacementRound(roundId);
  assertUniversityScope(actor, round.universityId);
  if (input.participantIds.length === 0) {
    throw AppError.validationError("At least one participant is required.");
  }
  if (input.slots.length < input.participantIds.length) {
    throw AppError.validationError("Provide at least one time slot per participant.");
  }

  const participants = await Promise.all(input.participantIds.map((participantId) => readRoundParticipant(participantId)));
  participants.forEach((participant) => {
    if (participant.roundId !== roundId) {
      throw AppError.validationError("Every participant must belong to the selected round.");
    }
  });

  const plannedAssignments = participants.map((participant, index) => {
    const slot = input.slots[index];
    const normalized = normalizeScheduleInput(participant, {
      scheduledStart: slot.scheduledStart,
      scheduledEnd: slot.scheduledEnd,
      slotLabel: slot.slotLabel,
      room: slot.room,
      location: slot.location,
      meetingLink: slot.meetingLink,
      interviewerIds: slot.interviewerIds,
      instructions: slot.instructions,
      scheduleTimezone: slot.scheduleTimezone,
      scheduleStatus: participant.scheduledStart || participant.scheduledEnd ? "rescheduled" : "scheduled",
    });
    return { participant, normalized };
  });

  assertNoInPayloadClashes(plannedAssignments.map(({ participant, normalized }) => ({
    participantId: participant.$id,
    studentId: participant.studentId,
    scheduledStart: normalized.scheduledStart,
    scheduledEnd: normalized.scheduledEnd,
    interviewerIds: normalized.interviewerIds,
    room: normalized.room,
    scheduleStatus: normalized.scheduleStatus,
  })));

  for (const assignment of plannedAssignments) {
    await assertNoScheduleClash(actor, {
      participantId: assignment.participant.$id,
      studentId: assignment.participant.studentId,
      roundId,
      scheduledStart: assignment.normalized.scheduledStart,
      scheduledEnd: assignment.normalized.scheduledEnd,
      interviewerIds: assignment.normalized.interviewerIds,
      room: assignment.normalized.room,
      scheduleStatus: assignment.normalized.scheduleStatus,
    });
  }

  const updated = await Promise.all(plannedAssignments.map(({ participant, normalized }) =>
    updateRoundParticipantForAdmin(actor, participant.$id, {
      scheduledStart: normalized.scheduledStart,
      scheduledEnd: normalized.scheduledEnd,
      slotLabel: normalized.slotLabel,
      room: normalized.room,
      location: normalized.location,
      meetingLink: normalized.meetingLink,
      interviewerIds: normalized.interviewerIds,
      instructions: normalized.instructions,
      scheduleTimezone: normalized.scheduleTimezone,
      scheduleStatus: normalized.scheduleStatus,
    })
  ));

  await createAuditLog(actor, {
    action: "round.bulk_scheduled",
    entityType: "placement_round",
    entityId: roundId,
    newValue: {
      participantIds: input.participantIds,
      slotCount: input.slots.length,
    },
  });

  return updated;
}

export async function removeRoundParticipantForAdmin(actor: AppUser, participantId: string): Promise<ApplicationDetail> {
  assertAdmin(actor);
  const participant = await readRoundParticipant(participantId);
  const application = await readApplication(participant.applicationId);
  assertUniversityScope(actor, application.universityId);
  const { databases } = createServerServices();
  const result = await readRoundResultByApplication(participant.applicationId, participant.roundId);
  await databases.deleteDocument(DATABASE_ID, Collections.ROUND_PARTICIPANTS, participantId);
  if (result) {
    await databases.deleteDocument(DATABASE_ID, Collections.RESULTS, result.$id);
  }

  if (application.currentRoundId === participant.roundId) {
    await databases.updateDocument(DATABASE_ID, Collections.APPLICATIONS, application.$id, {
      currentRoundId: null,
      status: "SHORTLISTED",
      updatedAt: new Date().toISOString(),
      lastStatusChangedAt: new Date().toISOString(),
    });
  }

  await createAuditLog(actor, {
    action: "round_participant.removed",
    entityType: "round_participant",
    entityId: participantId,
    previousValue: { ...participant },
  });

  return getAdminApplicationDetail(actor, application.$id);
}

export async function advanceApplicationFromRoundForAdmin(
  actor: AppUser,
  applicationId: string,
  roundId: string,
  notes?: string
): Promise<ApplicationDetail> {
  assertAdmin(actor);
  const application = await readApplication(applicationId);
  assertUniversityScope(actor, application.universityId);
  const rounds = await listPlacementRoundsForAdmin(actor, application.roleId);
  const currentIndex = rounds.findIndex((round) => round.$id === roundId);
  if (currentIndex < 0) {
    throw AppError.validationError("Round not found for this role.");
  }

  const participant = await readRoundParticipantByApplication(applicationId, roundId);
  if (participant) {
    await upsertRoundResult(actor, participant, application, {
      outcome: currentIndex === rounds.length - 1 ? "SELECTED" : "PASSED",
      score: participant.score,
      feedback: cleanOptional(notes),
    });
  }

  const nextRound = rounds[currentIndex + 1];
  if (!nextRound) {
    return updateApplicationStatusForAdmin(actor, applicationId, "SELECTED", notes, "application.selected");
  }
  return moveApplicationToRoundForAdmin(actor, applicationId, nextRound.$id, notes);
}

export async function runBulkApplicationActionForAdmin(
  actor: AppUser,
  input: {
    action: "shortlist" | "reject" | "move_to_round" | "auto_shortlist";
    applicationIds?: string[];
    notes?: string;
    roundId?: string;
    filters?: ApplicationFilters;
  }
): Promise<BulkActionResult> {
  assertAdmin(actor);
  const applications = input.applicationIds?.length
    ? await readScopedApplications(actor, input.applicationIds)
    : await listMatchingApplicationsForBulk(actor, input.filters);

  if (applications.length === 0) {
    throw AppError.validationError("No applications matched this action.");
  }

  const operation = await createBulkOperation(actor, {
    action: input.action === "auto_shortlist" ? "auto_shortlist" : mapBulkAction(input.action),
    targetCount: applications.length,
    input: {
      applicationIds: applications.map((item) => item.$id),
      notes: cleanOptional(input.notes) ?? null,
      roundId: input.roundId ?? null,
      filters: input.filters ?? null,
    },
  });

  if (applications.length > DIRECT_BULK_LIMIT || input.action === "auto_shortlist") {
    await dispatchBulkOperation(actor, operation);
    return { mode: "queued", operation };
  }

  const result = await executeBulkOperation(actor, operation.$id);
  return {
    mode: "direct",
    operation: result.operation,
    applications: result.applications,
  };
}

export async function executeBulkOperation(actor: AppUser, operationId: string): Promise<BulkOperationSummary> {
  assertAdmin(actor);
  const operation = await readBulkOperation(actor, operationId);
  if (operation.status === "completed") {
    const applicationIds = extractApplicationIds(operation.input);
    const applications = applicationIds.length ? await Promise.all(applicationIds.map((id) => getAdminApplicationDetail(actor, id))) : [];
    return { operation, applications };
  }

  await updateBulkOperation(actor, operationId, { status: "running" });

  const payload = operation.input;
  const applicationIds = extractApplicationIds(payload);
  const action = operation.action;
  const notes = cleanOptional(asOptionalString(payload.notes));
  const roundId = asOptionalString(payload.roundId);
  const updated: ApplicationDetail[] = [];
  let failureCount = 0;

  if (action === "csv_import") {
    const rows = parseImportRows(payload.rows);
    for (const row of rows) {
      try {
        if (row.action === "shortlist") {
          updated.push(await shortlistApplicationForAdmin(actor, row.applicationId, row.notes));
        } else if (row.action === "reject") {
          updated.push(await rejectApplicationForAdmin(actor, row.applicationId, row.notes));
        } else {
          if (!row.roundId) {
            throw AppError.validationError("CSV move_to_round rows require roundId.");
          }
          updated.push(await moveApplicationToRoundForAdmin(actor, row.applicationId, row.roundId, row.notes));
        }
      } catch {
        failureCount += 1;
      }
    }
  } else {
    for (const applicationId of applicationIds) {
      try {
        if (action === "bulk_shortlist" || action === "auto_shortlist") {
          updated.push(await shortlistApplicationForAdmin(actor, applicationId, notes));
        } else if (action === "bulk_reject") {
          updated.push(await rejectApplicationForAdmin(actor, applicationId, notes));
        } else if (action === "bulk_move_to_round") {
          if (!roundId) {
            throw AppError.validationError("Round is required for move to round.");
          }
          updated.push(await moveApplicationToRoundForAdmin(actor, applicationId, roundId, notes));
        }
      } catch {
        failureCount += 1;
      }
    }
  }

  const finalStatus = failureCount > 0 && updated.length === 0 ? "failed" : "completed";
  const summary = {
    applicationIds,
    updatedIds: updated.map((item) => item.$id),
  };
  const finalized = await updateBulkOperation(actor, operationId, {
    status: finalStatus,
    processedCount: applicationIds.length,
    successCount: updated.length,
    failureCount,
    summary,
    completedAt: new Date().toISOString(),
  });

  await createAuditLog(actor, {
    action: `bulk_operation.${operation.action}`,
    entityType: "bulk_operation",
    entityId: operationId,
    previousValue: { status: operation.status },
    newValue: {
      status: finalized.status,
      targetCount: finalized.targetCount,
      processedCount: finalized.processedCount,
      successCount: finalized.successCount,
      failureCount: finalized.failureCount,
      summary,
    },
  });

  return { operation: finalized, applications: updated };
}

export async function exportApplicationsCsvForAdmin(actor: AppUser, filters: ApplicationFilters): Promise<string> {
  assertAdmin(actor);
  const matched = await listMatchingApplicationsForBulk(actor, filters);
  const operation = await createBulkOperation(actor, {
    action: "csv_export",
    targetCount: matched.length,
    input: { filters },
  });

  const variableDefinitions = await loadVariableDefinitions(actor);
  const headers = ["applicationId", "studentName", "studentEmail", "company", "role", "status", "currentRoundId", "appliedAt", "notes", ...variableDefinitions.map((item) => item.name)];
  const rows = matched.map((item) => [
    item.$id,
    item.student.name,
    item.student.email,
    item.company.name,
    item.role.title,
    item.status,
    item.currentRoundId ?? "",
    item.appliedAt,
    item.notes ?? "",
    ...variableDefinitions.map((variable) => serializeCsvValue(item.student.variableValues[variable.name])),
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");

  await updateBulkOperation(actor, operation.$id, {
    status: "completed",
    processedCount: matched.length,
    successCount: matched.length,
    summary: { exportedCount: matched.length, columns: headers },
    completedAt: new Date().toISOString(),
  });
  await createAuditLog(actor, {
    action: "bulk_operation.csv_export",
    entityType: "bulk_operation",
    entityId: operation.$id,
    newValue: { exportedCount: matched.length, filters },
  });

  return csv;
}

export async function importApplicationsCsvForAdmin(
  actor: AppUser,
  rows: ApplicationCsvImportRow[]
): Promise<BulkActionResult> {
  assertAdmin(actor);
  const operation = await createBulkOperation(actor, {
    action: "csv_import",
    targetCount: rows.length,
    input: { rows, applicationIds: rows.map((row) => row.applicationId) },
  });
  await dispatchBulkOperation(actor, operation);
  return { mode: "queued", operation };
}

async function updateApplicationStatusForAdmin(
  actor: AppUser,
  applicationId: string,
  nextStatus: ApplicationStatus,
  notes: string | undefined,
  auditAction: string
): Promise<ApplicationDetail> {
  assertAdmin(actor);
  const application = await readApplication(applicationId);
  assertUniversityScope(actor, application.universityId);

  if (application.status === "WITHDRAWN") {
    throw AppError.validationError("Withdrawn applications cannot be updated.");
  }
  if (application.status === nextStatus) {
    return getAdminApplicationDetail(actor, applicationId);
  }

  const now = new Date().toISOString();
  const { databases } = createServerServices();
  const resolvedNotes = cleanOptional(notes) ?? application.notes ?? null;
  await databases.updateDocument(
    DATABASE_ID,
    Collections.APPLICATIONS,
    applicationId,
    {
      status: nextStatus,
      notes: resolvedNotes,
      lastStatusChangedAt: now,
      updatedAt: now,
    }
  );

  await createAuditLog(actor, {
    action: auditAction,
    entityType: "application",
    entityId: applicationId,
    previousValue: { status: application.status, notes: application.notes ?? null },
    newValue: { status: nextStatus, notes: resolvedNotes },
  });
  const detail = await getAdminApplicationDetail(actor, applicationId);
  if (nextStatus === "SHORTLISTED") {
    await dispatchNotificationEvent({
      type: "SHORTLISTED",
      universityId: detail.universityId,
      recipientUserIds: [detail.student.userId],
      entityId: detail.$id,
      entityType: "application",
      dedupeKey: `application-shortlisted:${detail.$id}:${now}`,
      variables: {
        student_name: detail.student.name,
        company_name: detail.company.name,
        role_name: detail.role.title,
      },
    });
  }

  return detail;
}

async function dispatchRoundNotification(
  roundId: string,
  type: "ROUND_SCHEDULED" | "ROUND_UPDATED",
  dedupeKey: string
): Promise<void> {
  const round = await readPlacementRound(roundId);
  const role = await readRole(round.roleId);
  const company = await readCompany(role.companyId);
  const participants = await readRoundParticipantsByRound(roundId);
  if (participants.length === 0) {
    return;
  }

  const details = await Promise.all(participants.map(async (participant) => hydrateApplicationDetail(await readApplication(participant.applicationId))));
  await Promise.all(details.map((detail) =>
    dispatchNotificationEvent({
      type,
      universityId: detail.universityId,
      recipientUserIds: [detail.student.userId],
      entityId: roundId,
      entityType: "placement_round",
      dedupeKey: `${dedupeKey}:${detail.$id}`,
      variables: {
        student_name: detail.student.name,
        company_name: company.name,
        role_name: role.title,
        round_name: round.name,
      },
    })
  ));
}

async function paginateAndHydrateApplications(
  actor: AppUser,
  applications: Application[],
  filters: ApplicationFilters,
  includeAllStatuses: boolean
): Promise<PaginatedApplications<ApplicationDetail>> {
  const hydrated = await filterAndHydrateApplications(actor, applications, filters, includeAllStatuses);
  searchedSortInPlace(hydrated);
  return paginate(hydrated, filters.page);
}

async function filterAndHydrateApplications(
  actor: AppUser,
  applications: Application[],
  filters: ApplicationFilters,
  includeAllStatuses: boolean
): Promise<ApplicationDetail[]> {
  const search = filters.search?.trim().toLowerCase();
  const status = filters.status ?? "all";
  let filtered = applications.slice();

  if (!includeAllStatuses) {
    filtered = filtered.filter((item) => item.universityId === actor.universityId);
  }
  if (status !== "all") {
    filtered = filtered.filter((item) => item.status === status);
  }
  if (filters.roleId) {
    filtered = filtered.filter((item) => item.roleId === filters.roleId);
  }
  if (filters.companyId) {
    filtered = filtered.filter((item) => item.companyId === filters.companyId);
  }

  const hydrated = await Promise.all(filtered.map(hydrateApplicationDetail));
  const variableContext = await buildVariableContextForUniversity(actor);
  const filterValidation = validateEligibilityRuleTree(filters.studentFilter ?? null, { variables: variableContext.variableMap });
  if (!filterValidation.valid) {
    throw AppError.validationError(filterValidation.errors.join("; "));
  }
  const byStudentVariables = filters.studentFilter
    ? hydrated.filter((item) => evaluateEligibilityRule(filters.studentFilter ?? null, {
        userId: item.student.userId,
        profileId: item.student.profileId,
        universityId: actor.universityId,
        values: item.student.variableValues,
      }, { variables: variableContext.variableMap }))
    : hydrated;
  const searched = search
    ? byStudentVariables.filter((item) =>
        item.role.title.toLowerCase().includes(search) ||
        item.company.name.toLowerCase().includes(search) ||
        item.status.toLowerCase().includes(search) ||
        item.student.name.toLowerCase().includes(search) ||
        item.student.email.toLowerCase().includes(search)
      )
    : byStudentVariables;
  return searched;
}

function searchedSortInPlace(applications: ApplicationDetail[]): void {
  applications.sort((left, right) => new Date(right.appliedAt).getTime() - new Date(left.appliedAt).getTime());
}

async function hydrateApplicationDetail(application: Application): Promise<ApplicationDetail> {
  const [role, company, timeline, student, rounds, participants, results] = await Promise.all([
    readRole(application.roleId),
    readCompany(application.companyId),
    readApplicationTimeline(application.$id),
    readApplicationStudent(application.studentId),
    readRoundsForRole(application.roleId),
    readRoundParticipantsForApplication(application.$id),
    readRoundResultsForApplication(application.$id),
  ]);
  const workflow = buildApplicationWorkflow(application, rounds, participants, results);

  return {
    ...application,
    role,
    company,
    student,
    timeline,
    workflow,
    currentRound: workflow.find((entry) => entry.round.$id === application.currentRoundId),
  };
}

async function assertStudentEligibility(actor: AppUser, roleId: string, studentProfileId: string): Promise<void> {
  const result = await evaluateEligibilityResultForRole(actor, { roleId, studentProfileId });
  if (!result.eligible) {
    throw AppError.forbidden("You are not eligible for this role.");
  }
}

async function assertRoleOpenForApplications(role: Role): Promise<void> {
  if (role.status !== "published") {
    throw AppError.validationError("This role is not open for applications.");
  }
  if (role.applicationDeadline && new Date(role.applicationDeadline).getTime() < Date.now()) {
    throw AppError.validationError("The application deadline has passed.");
  }
}

async function readApplicationsByStudent(studentId: string): Promise<Application[]> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.APPLICATIONS,
    [Query.equal("studentId", studentId), Query.limit(200)]
  );
  return result.documents.map(docToApplication);
}

async function readApplicationByStudentAndRole(studentId: string, roleId: string): Promise<Application | null> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.APPLICATIONS,
    [Query.equal("studentId", studentId), Query.equal("roleId", roleId), Query.limit(1)]
  );
  return result.documents[0] ? docToApplication(result.documents[0]) : null;
}

async function readApplication(applicationId: string): Promise<Application> {
  const { databases } = createServerServices();
  try {
    const doc = await databases.getDocument<Models.DefaultDocument>(DATABASE_ID, Collections.APPLICATIONS, applicationId);
    return docToApplication(doc);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw AppError.notFound("Application not found.");
    }
    throw error;
  }
}

async function readApplicationTimeline(applicationId: string): Promise<ApplicationTimelineEntry[]> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.AUDIT_LOGS,
    [Query.equal("entityType", "application"), Query.equal("entityId", applicationId), Query.limit(200)]
  );

  return result.documents
    .map((doc) => ({
      $id: doc.$id,
      action: String(doc.action),
      actorId: String(doc.actorId),
      actorRole: String(doc.actorRole),
      timestamp: String(doc.timestamp ?? doc.$createdAt),
      previousValue: (doc.previousValue as Record<string, unknown> | null) ?? undefined,
      newValue: (doc.newValue as Record<string, unknown> | null) ?? undefined,
    }))
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
}

async function readApplicationStudent(profileId: string): Promise<ApplicationDetail["student"]> {
  const { databases } = createServerServices();
  const profileDoc = await databases.getDocument<Models.DefaultDocument>(DATABASE_ID, Collections.STUDENT_PROFILES, profileId);
  const userDoc = await databases.getDocument<Models.DefaultDocument>(DATABASE_ID, Collections.USERS, String(profileDoc.userId));
  const profile = docToStudentProfile(profileDoc);

  return {
    userId: profile.userId,
    profileId: profile.$id,
    name: String(userDoc.name),
    email: String(userDoc.email),
    variableValues: extractVariableValuesFromStudentProfile(profile),
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

async function readPlacementRound(roundId: string): Promise<PlacementRound> {
  const { databases } = createServerServices();
  const doc = await databases.getDocument<Models.DefaultDocument>(DATABASE_ID, Collections.PLACEMENT_ROUNDS, roundId);
  return docToPlacementRound(doc);
}

async function ensureRoundParticipant(roundId: string, application: Application): Promise<void> {
  const { databases } = createServerServices();
  const existing = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.ROUND_PARTICIPANTS,
    [Query.equal("roundId", roundId), Query.equal("applicationId", application.$id), Query.limit(1)]
  );

  if (existing.documents[0]) {
    return;
  }

  const now = new Date().toISOString();
  await databases.createDocument(
    DATABASE_ID,
    Collections.ROUND_PARTICIPANTS,
    ID.unique(),
    {
      roundId,
      applicationId: application.$id,
      studentId: application.studentId,
      scheduledStart: null,
      scheduledEnd: null,
      slotLabel: null,
      room: null,
      location: null,
      meetingLink: null,
      scheduleTimezone: null,
      scheduleStatus: "pending",
      cancellationReason: null,
      instructions: null,
      interviewerIds: [],
      score: null,
      passed: null,
      notes: null,
      resultPublished: false,
      publishedAt: null,
      lastScheduledAt: null,
      createdAt: now,
      updatedAt: now,
    }
  );
}

async function readRoundsForRole(roleId: string): Promise<PlacementRound[]> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.PLACEMENT_ROUNDS,
    [Query.equal("roleId", roleId), Query.limit(200)]
  );
  return result.documents.map(docToPlacementRound).sort((left, right) => left.sequence - right.sequence);
}

async function readRoundParticipantsForApplication(applicationId: string): Promise<RoundParticipant[]> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.ROUND_PARTICIPANTS,
    [Query.equal("applicationId", applicationId), Query.limit(200)]
  );
  return result.documents.map(docToRoundParticipant);
}

async function readRoundParticipantsByRound(roundId: string): Promise<RoundParticipant[]> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.ROUND_PARTICIPANTS,
    [Query.equal("roundId", roundId), Query.limit(500)]
  );
  return result.documents.map(docToRoundParticipant);
}

async function readRoundParticipant(participantId: string): Promise<RoundParticipant> {
  const { databases } = createServerServices();
  const doc = await databases.getDocument<Models.DefaultDocument>(DATABASE_ID, Collections.ROUND_PARTICIPANTS, participantId);
  return docToRoundParticipant(doc);
}

async function readRoundParticipantByApplication(applicationId: string, roundId: string): Promise<RoundParticipant | null> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.ROUND_PARTICIPANTS,
    [Query.equal("applicationId", applicationId), Query.equal("roundId", roundId), Query.limit(1)]
  );
  return result.documents[0] ? docToRoundParticipant(result.documents[0]) : null;
}

async function readRoundResultsForApplication(applicationId: string): Promise<RoundResult[]> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.RESULTS,
    [Query.equal("applicationId", applicationId), Query.limit(200)]
  );
  return result.documents.map(docToRoundResult);
}

async function readRoundResultsByRound(roundId: string): Promise<RoundResult[]> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.RESULTS,
    [Query.equal("roundId", roundId), Query.limit(500)]
  );
  return result.documents.map(docToRoundResult);
}

async function readRoundResultByApplication(applicationId: string, roundId: string): Promise<RoundResult | null> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.RESULTS,
    [Query.equal("applicationId", applicationId), Query.equal("roundId", roundId), Query.limit(1)]
  );
  return result.documents[0] ? docToRoundResult(result.documents[0]) : null;
}

async function readRole(roleId: string): Promise<Role> {
  const { databases } = createServerServices();
  const doc = await databases.getDocument<Models.DefaultDocument>(DATABASE_ID, Collections.ROLES, roleId);
  return {
    $id: doc.$id,
    companyId: String(doc.companyId),
    universityId: String(doc.universityId),
    title: String(doc.title),
    jdText: (doc.jdText as string | null) ?? undefined,
    jdAttachmentId: (doc.jdAttachmentId as string | null) ?? undefined,
    location: (doc.location as string | null) ?? undefined,
    workMode: (doc.workMode as Role["workMode"] | null) ?? undefined,
    employmentType: (doc.employmentType as Role["employmentType"] | null) ?? undefined,
    ctc: typeof doc.ctc === "number" ? doc.ctc : undefined,
    fixedCtc: typeof doc.fixedCtc === "number" ? doc.fixedCtc : undefined,
    variableCtc: typeof doc.variableCtc === "number" ? doc.variableCtc : undefined,
    joiningDate: (doc.joiningDate as string | null) ?? undefined,
    experienceRequirementMonths: typeof doc.experienceRequirementMonths === "number" ? doc.experienceRequirementMonths : undefined,
    numberOfOpenings: typeof doc.numberOfOpenings === "number" ? doc.numberOfOpenings : undefined,
    applicationDeadline: (doc.applicationDeadline as string | null) ?? undefined,
    selectionProcessDescription: (doc.selectionProcessDescription as string | null) ?? undefined,
    eligibilityRuleSetId: (doc.eligibilityRuleSetId as string | null) ?? undefined,
    requiredSkills: Array.isArray(doc.requiredSkills) ? (doc.requiredSkills as string[]) : [],
    requiredQualifications: Array.isArray(doc.requiredQualifications) ? (doc.requiredQualifications as string[]) : [],
    status: doc.status as Role["status"],
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

async function readCompany(companyId: string): Promise<Company> {
  const { databases } = createServerServices();
  const doc = await databases.getDocument<Models.DefaultDocument>(DATABASE_ID, Collections.COMPANIES, companyId);
  return {
    $id: doc.$id,
    universityId: String(doc.universityId),
    name: String(doc.name),
    logo: (doc.logo as string | null) ?? undefined,
    website: (doc.website as string | null) ?? undefined,
    industry: (doc.industry as string | null) ?? undefined,
    description: (doc.description as string | null) ?? undefined,
    locations: Array.isArray(doc.locations) ? (doc.locations as string[]) : [],
    companyType: (doc.companyType as string | null) ?? undefined,
    contactInfo: (doc.contactInfo as Company["contactInfo"]) ?? {},
    isActive: Boolean(doc.isActive),
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
    description: (doc.description as string | null) ?? undefined,
    instructions: (doc.instructions as string | null) ?? undefined,
    startTime: (doc.startTime as string | null) ?? undefined,
    endTime: (doc.endTime as string | null) ?? undefined,
    location: (doc.location as string | null) ?? undefined,
    meetingLink: (doc.meetingLink as string | null) ?? undefined,
    capacity: typeof doc.capacity === "number" ? doc.capacity : undefined,
    evaluators: Array.isArray(doc.evaluators) ? (doc.evaluators as string[]) : [],
    status: doc.status as PlacementRound["status"],
    sequence: typeof doc.sequence === "number" ? doc.sequence : 0,
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

function docToRoundParticipant(doc: Models.DefaultDocument): RoundParticipant {
  return {
    $id: doc.$id,
    roundId: String(doc.roundId),
    applicationId: String(doc.applicationId),
    studentId: String(doc.studentId),
    scheduledStart: cleanOptional(asOptionalString(doc.scheduledStart)),
    scheduledEnd: cleanOptional(asOptionalString(doc.scheduledEnd)),
    slotLabel: cleanOptional(asOptionalString(doc.slotLabel)),
    room: cleanOptional(asOptionalString(doc.room)),
    location: cleanOptional(asOptionalString(doc.location)),
    meetingLink: cleanOptional(asOptionalString(doc.meetingLink)),
    scheduleTimezone: cleanOptional(asOptionalString(doc.scheduleTimezone)),
    scheduleStatus: (doc.scheduleStatus as InterviewScheduleStatus | null) ?? "pending",
    cancellationReason: cleanOptional(asOptionalString(doc.cancellationReason)),
    instructions: cleanOptional(asOptionalString(doc.instructions)),
    interviewerIds: Array.isArray(doc.interviewerIds) ? (doc.interviewerIds as string[]) : [],
    score: typeof doc.score === "number" ? doc.score : undefined,
    passed: typeof doc.passed === "boolean" ? doc.passed : undefined,
    notes: cleanOptional(asOptionalString(doc.notes)),
    resultPublished: Boolean(doc.resultPublished),
    publishedAt: cleanOptional(asOptionalString(doc.publishedAt)),
    lastScheduledAt: cleanOptional(asOptionalString(doc.lastScheduledAt)),
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

function docToRoundResult(doc: Models.DefaultDocument): RoundResult {
  return {
    $id: doc.$id,
    roundId: String(doc.roundId),
    applicationId: String(doc.applicationId),
    studentId: String(doc.studentId),
    universityId: String(doc.universityId),
    outcome: doc.outcome as RoundResult["outcome"],
    score: typeof doc.score === "number" ? doc.score : undefined,
    feedback: cleanOptional(asOptionalString(doc.feedback)),
    publishedAt: cleanOptional(asOptionalString(doc.publishedAt)),
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

function buildApplicationWorkflow(
  application: Application,
  rounds: PlacementRound[],
  participants: RoundParticipant[],
  results: RoundResult[]
): ApplicationRoundWorkflow[] {
  const participantsByRound = new Map(participants.map((item) => [item.roundId, item]));
  const resultsByRound = new Map(results.map((item) => [item.roundId, item]));

  return rounds.map((round) => {
    const participant = participantsByRound.get(round.$id);
    const result = resultsByRound.get(round.$id);
    let state: ApplicationRoundWorkflow["state"] = "upcoming";

    if (application.status === "REJECTED" && application.currentRoundId === round.$id) {
      state = "rejected";
    } else if (application.currentRoundId === round.$id || round.status === "active") {
      state = "active";
    } else if (participant?.scheduleStatus === "cancelled") {
      state = "completed";
    } else if (result?.outcome === "SELECTED" || (application.status === "SELECTED" && participant)) {
      state = "selected";
    } else if (participant || result) {
      state = "completed";
    }

    return { round, participant, result, state };
  });
}

async function listMatchingApplicationsForBulk(actor: AppUser, filters?: ApplicationFilters): Promise<ApplicationDetail[]> {
  const { databases } = createServerServices();
  const queries =
    actor.role === USER_ROLES.SUPER_ADMIN
      ? [Query.limit(500)]
      : [Query.equal("universityId", actor.universityId), Query.limit(500)];
  const result = await databases.listDocuments<Models.DefaultDocument>(DATABASE_ID, Collections.APPLICATIONS, queries);
  return filterAndHydrateApplications(actor, result.documents.map(docToApplication), filters ?? {}, true);
}

async function readScopedApplications(actor: AppUser, applicationIds: string[]): Promise<ApplicationDetail[]> {
  const applications = await Promise.all(applicationIds.map((applicationId) => getAdminApplicationDetail(actor, applicationId)));
  return applications.filter((item) => item.universityId === actor.universityId || actor.role === USER_ROLES.SUPER_ADMIN);
}

async function loadVariableDefinitions(actor: AppUser): Promise<VariableDefinition[]> {
  const context = await buildVariableContextForUniversity(actor);
  return context.definitions;
}

async function upsertRoundResult(
  actor: AppUser,
  participant: RoundParticipant,
  application: Application,
  input: {
    outcome: RoundOutcome;
    score?: number;
    feedback?: string;
    publishedAt?: string;
  }
): Promise<void> {
  const existing = await readRoundResultByApplication(application.$id, participant.roundId);
  const { databases } = createServerServices();
  const now = new Date().toISOString();
  if (existing) {
    await databases.updateDocument(DATABASE_ID, Collections.RESULTS, existing.$id, {
      outcome: input.outcome,
      score: input.score ?? null,
      feedback: cleanOptional(input.feedback) ?? null,
      publishedAt: input.publishedAt ?? existing.publishedAt ?? null,
      updatedAt: now,
    });
    return;
  }

  await databases.createDocument(DATABASE_ID, Collections.RESULTS, ID.unique(), {
    roundId: participant.roundId,
    applicationId: application.$id,
    studentId: application.studentId,
    universityId: application.universityId,
    outcome: input.outcome,
    score: input.score ?? null,
    feedback: cleanOptional(input.feedback) ?? null,
    publishedAt: input.publishedAt ?? null,
    createdAt: now,
    updatedAt: now,
  });

  await createAuditLog(actor, {
    action: "round_result.recorded",
    entityType: "application",
    entityId: application.$id,
    newValue: { roundId: participant.roundId, outcome: input.outcome },
  });
}

async function normalizeRoundSequences(actor: AppUser, roleId: string): Promise<void> {
  const rounds = await listPlacementRoundsForAdmin(actor, roleId);
  const { databases } = createServerServices();
  const now = new Date().toISOString();
  await Promise.all(rounds.map((round, index) => {
    if (round.sequence === index + 1) {
      return Promise.resolve();
    }
    return databases.updateDocument(DATABASE_ID, Collections.PLACEMENT_ROUNDS, round.$id, {
      sequence: index + 1,
      updatedAt: now,
    });
  }));
}

function normalizeScheduleInput(
  participant: RoundParticipant,
  input: Partial<{
    scheduledStart: string;
    scheduledEnd: string;
    slotLabel: string;
    room: string;
    location: string;
    meetingLink: string;
    scheduleTimezone: string;
    scheduleStatus: InterviewScheduleStatus;
    cancellationReason: string;
    instructions: string;
    interviewerIds: string[];
  }>
) {
  const scheduledStart = input.scheduledStart !== undefined ? normalizeIsoDateTime(input.scheduledStart, "scheduledStart") : participant.scheduledStart;
  const scheduledEnd = input.scheduledEnd !== undefined ? normalizeIsoDateTime(input.scheduledEnd, "scheduledEnd") : participant.scheduledEnd;
  const slotLabel = input.slotLabel !== undefined ? cleanOptional(input.slotLabel) : participant.slotLabel;
  const room = input.room !== undefined ? cleanOptional(input.room) : participant.room;
  const location = input.location !== undefined ? cleanOptional(input.location) : participant.location;
  const meetingLink = input.meetingLink !== undefined ? cleanOptional(input.meetingLink) : participant.meetingLink;
  const instructions = input.instructions !== undefined ? cleanOptional(input.instructions) : participant.instructions;
  const interviewerIds = input.interviewerIds !== undefined ? input.interviewerIds.map((item) => item.trim()).filter(Boolean) : participant.interviewerIds;
  const scheduleTimezone = input.scheduleTimezone !== undefined ? cleanOptional(input.scheduleTimezone) : participant.scheduleTimezone;
  const scheduleStatus = input.scheduleStatus ?? inferScheduleStatus(participant, scheduledStart, scheduledEnd);
  const cancellationReason = input.cancellationReason !== undefined ? cleanOptional(input.cancellationReason) : participant.cancellationReason;
  const hasSchedulingChange =
    input.scheduledStart !== undefined ||
    input.scheduledEnd !== undefined ||
    input.slotLabel !== undefined ||
    input.room !== undefined ||
    input.location !== undefined ||
    input.meetingLink !== undefined ||
    input.scheduleTimezone !== undefined ||
    input.scheduleStatus !== undefined ||
    input.cancellationReason !== undefined ||
    input.instructions !== undefined ||
    input.interviewerIds !== undefined;

  if ((scheduledStart && !scheduledEnd) || (!scheduledStart && scheduledEnd)) {
    throw AppError.validationError("Both start and end time are required when scheduling an interview.");
  }
  if (scheduledStart && scheduledEnd && new Date(scheduledEnd).getTime() <= new Date(scheduledStart).getTime()) {
    throw AppError.validationError("Interview end time must be after the start time.");
  }
  if (scheduleStatus === "cancelled" && !cancellationReason) {
    throw AppError.validationError("Cancellation reason is required when cancelling an interview.");
  }
  if (scheduleStatus !== "cancelled" && cancellationReason && !input.cancellationReason) {
    // preserve existing
  }

  return {
    scheduledStart,
    scheduledEnd,
    slotLabel,
    room,
    location,
    meetingLink,
    instructions,
    interviewerIds,
    scheduleTimezone,
    scheduleStatus,
    cancellationReason,
    hasSchedulingChange,
  };
}

function inferScheduleStatus(
  participant: RoundParticipant,
  scheduledStart?: string,
  scheduledEnd?: string
): InterviewScheduleStatus {
  if (!scheduledStart || !scheduledEnd) {
    return participant.scheduleStatus ?? "pending";
  }
  return participant.scheduledStart || participant.scheduledEnd ? "rescheduled" : "scheduled";
}

function normalizeIsoDateTime(value: string, field: string): string | undefined {
  const trimmed = cleanOptional(value);
  if (!trimmed) return undefined;
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) {
    throw AppError.validationError(`${field} must be a valid ISO date-time.`);
  }
  return new Date(timestamp).toISOString();
}

async function assertNoScheduleClash(
  actor: AppUser,
  input: {
    participantId: string;
    studentId: string;
    roundId: string;
    scheduledStart?: string;
    scheduledEnd?: string;
    interviewerIds: string[];
    room?: string;
    scheduleStatus: InterviewScheduleStatus;
  }
): Promise<void> {
  if (!input.scheduledStart || !input.scheduledEnd || input.scheduleStatus === "cancelled") {
    return;
  }
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(DATABASE_ID, Collections.ROUND_PARTICIPANTS, [Query.limit(500)]);
  const currentStart = new Date(input.scheduledStart).getTime();
  const currentEnd = new Date(input.scheduledEnd).getTime();

  const overlaps = result.documents
    .map(docToRoundParticipant)
    .filter((participant) => participant.$id !== input.participantId && participant.scheduleStatus !== "cancelled")
    .filter((participant) => {
      const start = participant.scheduledStart ? new Date(participant.scheduledStart).getTime() : NaN;
      const end = participant.scheduledEnd ? new Date(participant.scheduledEnd).getTime() : NaN;
      return !Number.isNaN(start) && !Number.isNaN(end) && start < currentEnd && end > currentStart;
    });

  const studentConflict = overlaps.find((participant) => participant.studentId === input.studentId);
  if (studentConflict) {
    throw AppError.validationError("Student clash detected with another scheduled interview.");
  }

  const interviewerConflict = overlaps.find((participant) => participant.interviewerIds.some((id) => input.interviewerIds.includes(id)));
  if (interviewerConflict) {
    throw AppError.validationError("Interviewer clash detected with another scheduled interview.");
  }

  if (input.room) {
    const roomConflict = overlaps.find((participant) => participant.room && participant.room === input.room);
    if (roomConflict) {
      throw AppError.validationError("Room clash detected with another scheduled interview.");
    }
  }
}

function assertNoInPayloadClashes(
  assignments: Array<{
    participantId: string;
    studentId: string;
    scheduledStart?: string;
    scheduledEnd?: string;
    interviewerIds: string[];
    room?: string;
    scheduleStatus: InterviewScheduleStatus;
  }>
): void {
  const active = assignments.filter((item) => item.scheduledStart && item.scheduledEnd && item.scheduleStatus !== "cancelled");
  for (let index = 0; index < active.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < active.length; otherIndex += 1) {
      const left = active[index];
      const right = active[otherIndex];
      const overlaps =
        new Date(left.scheduledStart!).getTime() < new Date(right.scheduledEnd!).getTime() &&
        new Date(left.scheduledEnd!).getTime() > new Date(right.scheduledStart!).getTime();
      if (!overlaps) continue;
      if (left.studentId === right.studentId) {
        throw AppError.validationError("Bulk schedule contains overlapping time slots for the same student.");
      }
      if (left.interviewerIds.some((id) => right.interviewerIds.includes(id))) {
        throw AppError.validationError("Bulk schedule contains overlapping interviewer assignments.");
      }
      if (left.room && right.room && left.room === right.room) {
        throw AppError.validationError("Bulk schedule contains overlapping room assignments.");
      }
    }
  }
}

async function createBulkOperation(
  actor: AppUser,
  input: {
    action: BulkOperation["action"];
    targetCount: number;
    input: Record<string, unknown>;
  }
): Promise<BulkOperation> {
  const { databases } = createServerServices();
  const now = new Date().toISOString();
  const doc = await databases.createDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.BULK_OPERATIONS,
    ID.unique(),
    {
      universityId: actor.universityId,
      actorId: actor.$id,
      actorRole: actor.role,
      action: input.action,
      status: "queued",
      targetCount: input.targetCount,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      input: input.input,
      summary: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    }
  );

  await createAuditLog(actor, {
    action: `bulk_operation.${input.action}.queued`,
    entityType: "bulk_operation",
    entityId: doc.$id,
    newValue: {
      action: input.action,
      targetCount: input.targetCount,
      input: input.input,
    },
  });

  return docToBulkOperation(doc);
}

async function readBulkOperation(actor: AppUser, operationId: string): Promise<BulkOperation> {
  const { databases } = createServerServices();
  const doc = await databases.getDocument<Models.DefaultDocument>(DATABASE_ID, Collections.BULK_OPERATIONS, operationId);
  const operation = docToBulkOperation(doc);
  assertUniversityScope(actor, operation.universityId);
  return operation;
}

async function updateBulkOperation(
  actor: AppUser,
  operationId: string,
  patch: Partial<Pick<BulkOperation, "status" | "processedCount" | "successCount" | "failureCount" | "summary" | "errorMessage" | "completedAt">>
): Promise<BulkOperation> {
  const { databases } = createServerServices();
  const doc = await databases.updateDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.BULK_OPERATIONS,
    operationId,
    {
      ...patch,
      updatedAt: new Date().toISOString(),
    }
  );
  return docToBulkOperation(doc);
}

async function dispatchBulkOperation(actor: AppUser, operation: BulkOperation): Promise<void> {
  const {
    APPWRITE_SHORTLISTING_FUNCTION_ID: functionId,
    APPWRITE_FUNCTION_SHARED_SECRET: sharedSecret,
  } = getServerEnv();
  if (!functionId) {
    await executeBulkOperation(actor, operation.$id);
    return;
  }
  if (!sharedSecret) {
    throw new Error("APPWRITE_FUNCTION_SHARED_SECRET is required when APPWRITE_SHORTLISTING_FUNCTION_ID is configured.");
  }

  const { functions } = createServerServices();
  try {
    await functions.createExecution(
      functionId,
      JSON.stringify(
        signFunctionPayload(
          {
            operationId: operation.$id,
            actorId: actor.$id,
            universityId: actor.universityId,
          },
          sharedSecret
        )
      ),
      true
    );
  } catch (error) {
    await updateBulkOperation(actor, operation.$id, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Failed to dispatch Appwrite Function.",
      completedAt: new Date().toISOString(),
    });
    throw error;
  }
}

function docToBulkOperation(doc: Models.DefaultDocument): BulkOperation {
  return {
    $id: doc.$id,
    universityId: String(doc.universityId),
    actorId: String(doc.actorId),
    actorRole: doc.actorRole as BulkOperation["actorRole"],
    action: doc.action as BulkOperation["action"],
    status: doc.status as BulkOperation["status"],
    targetCount: typeof doc.targetCount === "number" ? doc.targetCount : 0,
    processedCount: typeof doc.processedCount === "number" ? doc.processedCount : 0,
    successCount: typeof doc.successCount === "number" ? doc.successCount : 0,
    failureCount: typeof doc.failureCount === "number" ? doc.failureCount : 0,
    input: (doc.input as Record<string, unknown>) ?? {},
    summary: (doc.summary as Record<string, unknown> | null) ?? undefined,
    errorMessage: (doc.errorMessage as string | null) ?? undefined,
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
    completedAt: (doc.completedAt as string | null) ?? undefined,
  };
}

function docToApplication(doc: Models.DefaultDocument): Application {
  return {
    $id: doc.$id,
    studentId: String(doc.studentId),
    roleId: String(doc.roleId),
    companyId: String(doc.companyId),
    universityId: String(doc.universityId),
    status: doc.status as ApplicationStatus,
    currentRoundId: (doc.currentRoundId as string | null) ?? undefined,
    appliedAt: String(doc.appliedAt ?? doc.$createdAt),
    withdrawnAt: (doc.withdrawnAt as string | null) ?? undefined,
    lastStatusChangedAt: String(doc.lastStatusChangedAt ?? doc.$updatedAt),
    notes: (doc.notes as string | null) ?? undefined,
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

function paginate<T>(items: T[], page?: number): PaginatedApplications<T> {
  const normalizedPage = Number.isFinite(page) && page && page > 0 ? Math.floor(page) : 1;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(normalizedPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  return {
    items: items.slice(start, start + PAGE_SIZE),
    page: currentPage,
    pageSize: PAGE_SIZE,
    total,
    totalPages,
  };
}

function createDeterministicApplicationId(studentId: string, roleId: string): string {
  return `app_${createHash("sha256").update(`${studentId}:${roleId}`).digest("hex").slice(0, 24)}`;
}

function mapBulkAction(action: "shortlist" | "reject" | "move_to_round"): BulkOperation["action"] {
  if (action === "shortlist") return "bulk_shortlist";
  if (action === "reject") return "bulk_reject";
  return "bulk_move_to_round";
}

function extractApplicationIds(value: Record<string, unknown>): string[] {
  return Array.isArray(value.applicationIds) ? value.applicationIds.map(String).filter(Boolean) : [];
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseImportRows(value: unknown): ApplicationCsvImportRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }

    const record = row as Record<string, unknown>;
    const applicationId = asOptionalString(record.applicationId);
    const action = asOptionalString(record.action);
    if (!applicationId || (action !== "shortlist" && action !== "reject" && action !== "move_to_round")) {
      return [];
    }

    return [{
      applicationId,
      action,
      roundId: asOptionalString(record.roundId),
      notes: asOptionalString(record.notes),
    }];
  });
}

function serializeCsvValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join("|");
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function escapeCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;
}

function cleanOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isConflictError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: number }).code === 409;
}

function assertStudent(actor: AppUser): void {
  if (actor.role !== USER_ROLES.STUDENT) {
    throw AppError.forbidden("Student access is required.");
  }
}

function assertAdmin(actor: AppUser): void {
  if (actor.role !== USER_ROLES.PLACEMENT_ADMIN && actor.role !== USER_ROLES.SUPER_ADMIN) {
    throw AppError.forbidden("Admin access is required.");
  }
}

function assertUniversityScope(actor: AppUser, universityId: string): void {
  if (actor.role !== USER_ROLES.SUPER_ADMIN && actor.universityId !== universityId) {
    throw AppError.forbidden("You do not have access to this application.");
  }
}
