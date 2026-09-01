import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Models, Query } from "node-appwrite";
import { Collections, DATABASE_ID } from "@/lib/appwrite/constants";
import { getServerDatabases } from "@/lib/appwrite/server";
import { createAuditLog } from "@/lib/audit/service";
import {
  createCompanyForAdmin,
  createRoleForAdmin,
  listCompaniesForAdmin,
  listRolesForAdmin,
  updateCompanyForAdmin,
  updateRoleForAdmin,
} from "@/lib/companies/service";
import {
  listApplicationsForAdmin,
  moveApplicationToRoundForAdmin,
  rejectApplicationForAdmin,
  shortlistApplicationForAdmin,
  updateRoundParticipantForAdmin,
} from "@/lib/applications/service";
import { updateStudentProfileForActor } from "@/lib/student-profile/service";
import { AppError } from "@/lib/errors";
import type { AppUser, Role, RoundOutcome } from "@/types";

const PREVIEW_DIR = "/private/tmp/placely-import-export";
const MAX_PREVIEW_ROWS = 1000;

export const IMPORT_EXPORT_ENTITIES = [
  "students",
  "companies",
  "roles",
  "shortlists",
  "results",
  "interview_schedules",
] as const;

export const IMPORT_EXPORT_FORMATS = ["csv", "tsv"] as const;

export type ImportExportEntity = (typeof IMPORT_EXPORT_ENTITIES)[number];
export type ImportExportFormat = (typeof IMPORT_EXPORT_FORMATS)[number];

interface ImportRowResult {
  rowNumber: number;
  identifier: string;
  status: "ready" | "failed" | "success";
  reason?: string;
  values: Record<string, string>;
}

interface StoredImportPreview {
  previewId: string;
  actorId: string;
  universityId: string;
  entity: ImportExportEntity;
  fileName: string;
  format: ImportExportFormat;
  createdAt: string;
  rows: ImportRowResult[];
}

export interface ImportPreviewResult {
  previewId: string;
  entity: ImportExportEntity;
  fileName: string;
  format: ImportExportFormat;
  totalRows: number;
  readyRows: number;
  errorCount: number;
  rows: ImportRowResult[];
}

export interface ImportExecutionSummary {
  previewId: string;
  entity: ImportExportEntity;
  processedAt: string;
  totalRows: number;
  successfulRows: ImportRowResult[];
  failedRows: ImportRowResult[];
  errorReportId?: string;
}

export async function createImportPreview(
  actor: AppUser,
  entity: ImportExportEntity,
  file: File
): Promise<ImportPreviewResult> {
  const format = inferFormat(file.name);
  const content = await file.text();
  const rows = parseDelimitedTable(content, format);
  if (rows.length === 0) {
    throw AppError.validationError("Import file is empty.");
  }
  if (rows.length > MAX_PREVIEW_ROWS) {
    throw AppError.validationError(`Import file exceeds the ${MAX_PREVIEW_ROWS} row preview limit.`);
  }

  const validatedRows = await validateRows(actor, entity, rows);
  const preview: StoredImportPreview = {
    previewId: randomUUID(),
    actorId: actor.$id,
    universityId: actor.universityId,
    entity,
    fileName: file.name,
    format,
    createdAt: new Date().toISOString(),
    rows: validatedRows,
  };
  await savePreview(preview);

  await createAuditLog(actor, {
    action: "import.preview_created",
    entityType: entity,
    entityId: preview.previewId,
    newValue: {
      fileName: file.name,
      totalRows: preview.rows.length,
      errorCount: preview.rows.filter((row) => row.status === "failed").length,
    },
  });

  return toPreviewResult(preview);
}

export async function executeImportPreview(actor: AppUser, previewId: string): Promise<ImportExecutionSummary> {
  const preview = await loadPreview(previewId);
  assertPreviewScope(actor, preview);
  const failedValidationRows = preview.rows.filter((row) => row.status === "failed");
  if (failedValidationRows.length > 0) {
    throw AppError.validationError("Resolve validation errors before confirming the import.");
  }

  const successfulRows: ImportRowResult[] = [];
  const failedRows: ImportRowResult[] = [];

  for (const row of preview.rows) {
    try {
      await processRow(actor, preview.entity, row.values);
      successfulRows.push({ ...row, status: "success" });
    } catch (error) {
      failedRows.push({
        ...row,
        status: "failed",
        reason: error instanceof Error ? error.message : "Import processing failed.",
      });
    }
  }

  const processedAt = new Date().toISOString();
  const errorReportId = failedRows.length ? await saveErrorReport(preview.entity, failedRows) : undefined;

  await createAuditLog(actor, {
    action: "import.processed",
    entityType: preview.entity,
    entityId: previewId,
    newValue: {
      totalRows: preview.rows.length,
      successCount: successfulRows.length,
      failureCount: failedRows.length,
      errorReportId: errorReportId ?? null,
    },
  });

  return {
    previewId,
    entity: preview.entity,
    processedAt,
    totalRows: preview.rows.length,
    successfulRows,
    failedRows,
    errorReportId,
  };
}

export async function exportEntityRows(
  actor: AppUser,
  entity: ImportExportEntity,
  format: ImportExportFormat
): Promise<{ fileName: string; contentType: string; content: string }> {
  const rows = await collectRows(actor, entity);
  const content = serializeDelimitedTable(rows, format);
  await createAuditLog(actor, {
    action: "export.generated",
    entityType: entity,
    entityId: actor.universityId,
    newValue: { format, rowCount: Math.max(rows.length - 1, 0) },
  });
  return {
    fileName: `${entity}-export-${new Date().toISOString().slice(0, 10)}.${format}`,
    contentType: format === "csv" ? "text/csv; charset=utf-8" : "text/tab-separated-values; charset=utf-8",
    content,
  };
}

export async function readStoredReport(reportId: string): Promise<string> {
  const reportPath = path.join(PREVIEW_DIR, `${reportId}.report.tsv`);
  return readFile(reportPath, "utf8");
}

function inferFormat(fileName: string): ImportExportFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".tsv") || lower.endsWith(".txt")) return "tsv";
  if (lower.endsWith(".csv")) return "csv";
  throw AppError.validationError("Only CSV and Excel-friendly TSV/TXT files are supported.");
}

function parseDelimitedTable(content: string, format: ImportExportFormat): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headerLine = lines.shift();
  if (!headerLine) return [];
  const headers = splitLine(headerLine, format).map((value) => value.trim());
  return lines.map((line) => {
    const cells = splitLine(line, format);
    return Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? "").trim()]));
  });
}

function splitLine(line: string, format: ImportExportFormat): string[] {
  if (format === "tsv") {
    return line.split("\t");
  }
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

async function validateRows(
  actor: AppUser,
  entity: ImportExportEntity,
  rows: Record<string, string>[]
): Promise<ImportRowResult[]> {
  return Promise.all(rows.map(async (values, index) => {
    const rowNumber = index + 2;
    try {
      const identifier = await validateRow(actor, entity, values);
      return { rowNumber, identifier, status: "ready", values };
    } catch (error) {
      return {
        rowNumber,
        identifier: values.userId || values.email || values.companyId || values.roleId || values.applicationId || values.participantId || `row-${rowNumber}`,
        status: "failed",
        reason: error instanceof Error ? error.message : "Validation failed.",
        values,
      };
    }
  }));
}

async function validateRow(actor: AppUser, entity: ImportExportEntity, values: Record<string, string>): Promise<string> {
  switch (entity) {
    case "students":
      if (!values.userId && !values.email) throw AppError.validationError("Each student row needs userId or email.");
      return values.userId || values.email;
    case "companies":
      if (!values.name && !values.companyId) throw AppError.validationError("Each company row needs name or companyId.");
      return values.companyId || values.name;
    case "roles":
      if (!values.title && !values.roleId) throw AppError.validationError("Each role row needs title or roleId.");
      if (!values.companyId && !values.companyName && !values.roleId) {
        throw AppError.validationError("Each role row needs companyId or companyName.");
      }
      return values.roleId || values.title;
    case "shortlists":
      if (!values.applicationId) throw AppError.validationError("Each shortlist row needs applicationId.");
      if (!["shortlist", "reject", "move_to_round"].includes(values.action)) {
        throw AppError.validationError("Shortlist action must be shortlist, reject, or move_to_round.");
      }
      if (values.action === "move_to_round" && !values.roundId) {
        throw AppError.validationError("move_to_round rows require roundId.");
      }
      return values.applicationId;
    case "results":
      if (!values.applicationId || !values.roundId) throw AppError.validationError("Each result row needs applicationId and roundId.");
      if (!["PASSED", "FAILED", "WAITLISTED", "SELECTED"].includes(values.outcome)) {
        throw AppError.validationError("Result outcome must be PASSED, FAILED, WAITLISTED, or SELECTED.");
      }
      return `${values.applicationId}:${values.roundId}`;
    case "interview_schedules":
      if (!values.participantId && !(values.applicationId && values.roundId)) {
        throw AppError.validationError("Each schedule row needs participantId or applicationId + roundId.");
      }
      return values.participantId || `${values.applicationId}:${values.roundId}`;
  }
}

async function processRow(actor: AppUser, entity: ImportExportEntity, values: Record<string, string>): Promise<void> {
  switch (entity) {
    case "students":
      await processStudentRow(actor, values);
      return;
    case "companies":
      await processCompanyRow(actor, values);
      return;
    case "roles":
      await processRoleRow(actor, values);
      return;
    case "shortlists":
      await processShortlistRow(actor, values);
      return;
    case "results":
      await processResultRow(actor, values);
      return;
    case "interview_schedules":
      await processInterviewScheduleRow(actor, values);
      return;
  }
}

async function processStudentRow(actor: AppUser, values: Record<string, string>) {
  const targetUserId = values.userId || await resolveUserIdByEmail(actor.universityId, values.email);
  await updateStudentProfileForActor(actor, targetUserId, {
    identity: {
      name: values.name || undefined,
      phone: values.phone || undefined,
      dateOfBirth: values.dateOfBirth || undefined,
      gender: values.gender || undefined,
    },
    academic: {
      ugDegree: values.ugDegree || undefined,
      ugBranch: values.ugBranch || undefined,
      ugCgpa: asNumber(values.ugCgpa),
      graduationYear: asInteger(values.graduationYear),
      activeBacklogs: asInteger(values.activeBacklogs),
      totalBacklogs: asInteger(values.totalBacklogs),
      academicGaps: asInteger(values.academicGaps),
    },
  });
}

async function processCompanyRow(actor: AppUser, values: Record<string, string>) {
  const input = {
    name: values.name,
    website: values.website || undefined,
    industry: values.industry || undefined,
    description: values.description || undefined,
    locations: splitMultiline(values.locations),
    companyType: values.companyType || undefined,
    contactName: values.contactName || undefined,
    contactEmail: values.contactEmail || undefined,
    contactPhone: values.contactPhone || undefined,
  };
  if (values.companyId) {
    await updateCompanyForAdmin(actor, values.companyId, input);
    return;
  }
  await createCompanyForAdmin(actor, input);
}

async function processRoleRow(actor: AppUser, values: Record<string, string>) {
  const companyId = values.companyId || await resolveCompanyId(actor, values.companyName);
  const input = {
    companyId,
    title: values.title,
    location: values.location || undefined,
    workMode: (values.workMode as Role["workMode"]) || undefined,
    employmentType: (values.employmentType as Role["employmentType"]) || undefined,
    ctc: asNumber(values.ctc),
    fixedCtc: asNumber(values.fixedCtc),
    variableCtc: asNumber(values.variableCtc),
    joiningDate: values.joiningDate || undefined,
    numberOfOpenings: asInteger(values.numberOfOpenings),
    applicationDeadline: values.applicationDeadline || undefined,
    description: values.description || undefined,
    requiredSkills: splitMultiline(values.requiredSkills),
    requiredQualifications: splitMultiline(values.requiredQualifications),
    eligibilityRuleName: values.eligibilityRuleName || undefined,
    eligibilityRuleDescription: values.eligibilityRuleDescription || undefined,
    eligibilityRuleTree: values.eligibilityRuleTree ? JSON.parse(values.eligibilityRuleTree) : null,
  };
  if (values.roleId) {
    await updateRoleForAdmin(actor, values.roleId, input);
    return;
  }
  await createRoleForAdmin(actor, input);
}

async function processShortlistRow(actor: AppUser, values: Record<string, string>) {
  if (values.action === "shortlist") {
    await shortlistApplicationForAdmin(actor, values.applicationId, values.notes || undefined);
    return;
  }
  if (values.action === "reject") {
    await rejectApplicationForAdmin(actor, values.applicationId, values.notes || undefined);
    return;
  }
  if (values.action === "move_to_round") {
    await moveApplicationToRoundForAdmin(actor, values.applicationId, values.roundId, values.notes || undefined);
    return;
  }
  throw AppError.validationError("Unsupported shortlist import action.");
}

async function processResultRow(actor: AppUser, values: Record<string, string>) {
  const participantId = values.participantId || await resolveParticipantId(values.applicationId, values.roundId);
  await updateRoundParticipantForAdmin(actor, participantId, {
    outcome: values.outcome as RoundOutcome,
    score: asNumber(values.score),
    feedback: values.feedback || undefined,
    publishResult: asBoolean(values.publishResult) ?? false,
  });
}

async function processInterviewScheduleRow(actor: AppUser, values: Record<string, string>) {
  const participantId = values.participantId || await resolveParticipantId(values.applicationId, values.roundId);
  await updateRoundParticipantForAdmin(actor, participantId, {
    scheduledStart: values.scheduledStart || undefined,
    scheduledEnd: values.scheduledEnd || undefined,
    location: values.location || undefined,
    meetingLink: values.meetingLink || undefined,
    instructions: values.instructions || undefined,
    interviewerIds: splitMultiline(values.interviewerIds),
  });
}

async function collectRows(actor: AppUser, entity: ImportExportEntity): Promise<Record<string, string>[]> {
  switch (entity) {
    case "students":
      return collectStudentRows(actor);
    case "companies":
      return collectCompanyRows(actor);
    case "roles":
      return collectRoleRows(actor);
    case "shortlists":
      return collectShortlistRows(actor);
    case "results":
      return collectResultRows(actor);
    case "interview_schedules":
      return collectInterviewScheduleRows(actor);
  }
}

async function collectStudentRows(actor: AppUser) {
  const databases = getServerDatabases();
  const [users, profiles] = await Promise.all([
    databases.listDocuments<Models.DefaultDocument>(DATABASE_ID, Collections.USERS, [
      Query.equal("universityId", actor.universityId),
      Query.equal("role", "STUDENT"),
      Query.limit(500),
    ]),
    databases.listDocuments<Models.DefaultDocument>(DATABASE_ID, Collections.STUDENT_PROFILES, [
      Query.equal("universityId", actor.universityId),
      Query.limit(500),
    ]),
  ]);
  const profileByUserId = new Map(profiles.documents.map((doc) => [String(doc.userId), doc]));
  return users.documents.map((user) => {
    const profile = profileByUserId.get(user.$id);
    return {
      userId: user.$id,
      email: String(user.email),
      name: String(user.name),
      phone: String((profile?.personalInfo as Record<string, unknown> | undefined)?.phone ?? ""),
      ugDegree: String((profile?.academic as Record<string, unknown> | undefined)?.ugDegree ?? ""),
      ugBranch: String((profile?.academic as Record<string, unknown> | undefined)?.ugBranch ?? ""),
      ugCgpa: String((profile?.academic as Record<string, unknown> | undefined)?.ugCgpa ?? ""),
      graduationYear: String((profile?.academic as Record<string, unknown> | undefined)?.graduationYear ?? ""),
      activeBacklogs: String((profile?.academic as Record<string, unknown> | undefined)?.activeBacklogs ?? ""),
      totalBacklogs: String((profile?.academic as Record<string, unknown> | undefined)?.totalBacklogs ?? ""),
      academicGaps: String((profile?.academic as Record<string, unknown> | undefined)?.academicGaps ?? ""),
      placementStatus: String((profile?.placement as Record<string, unknown> | undefined)?.status ?? ""),
      numberOfOffers: String((profile?.placement as Record<string, unknown> | undefined)?.numberOfOffers ?? ""),
      verifiedAcademicData: String((profile?.placement as Record<string, unknown> | undefined)?.verifiedAcademicData ?? ""),
    };
  });
}

async function collectCompanyRows(actor: AppUser) {
  const companies = await listCompaniesForAdmin(actor, { search: "", status: "all", page: 1 });
  return companies.items.map((company) => ({
    companyId: company.$id,
    name: company.name,
    website: company.website ?? "",
    industry: company.industry ?? "",
    description: company.description ?? "",
    locations: company.locations.join("\n"),
    companyType: company.companyType ?? "",
    contactName: company.contactInfo?.name ?? "",
    contactEmail: company.contactInfo?.email ?? "",
    contactPhone: company.contactInfo?.phone ?? "",
  }));
}

async function collectRoleRows(actor: AppUser) {
  const roles = await listRolesForAdmin(actor, { search: "", status: "all", page: 1 });
  return roles.items.map((role) => ({
    roleId: role.$id,
    companyId: role.companyId,
    companyName: role.company.name,
    title: role.title,
    location: role.location ?? "",
    workMode: role.workMode ?? "",
    employmentType: role.employmentType ?? "",
    ctc: String(role.ctc ?? ""),
    fixedCtc: String(role.fixedCtc ?? ""),
    variableCtc: String(role.variableCtc ?? ""),
    joiningDate: role.joiningDate ?? "",
    numberOfOpenings: String(role.numberOfOpenings ?? ""),
    applicationDeadline: role.applicationDeadline ?? "",
    description: role.jdText ?? "",
    requiredSkills: role.requiredSkills.join("\n"),
    requiredQualifications: role.requiredQualifications.join("\n"),
  }));
}

async function collectShortlistRows(actor: AppUser) {
  const applications = await listApplicationsForAdmin(actor, { status: "all", page: 1 });
  return applications.items.map((application) => ({
    applicationId: application.$id,
    action: application.status === "SHORTLISTED" ? "shortlist" : "",
    status: application.status,
    studentName: application.student.name,
    roleTitle: application.role.title,
    roundId: application.currentRoundId ?? "",
    notes: application.notes ?? "",
  }));
}

async function collectResultRows(actor: AppUser) {
  const databases = getServerDatabases();
  const result = await databases.listDocuments<Models.DefaultDocument>(DATABASE_ID, Collections.RESULTS, [
    Query.equal("universityId", actor.universityId),
    Query.limit(500),
  ]);
  return result.documents.map((doc) => ({
    resultId: doc.$id,
    applicationId: String(doc.applicationId),
    roundId: String(doc.roundId),
    studentId: String(doc.studentId),
    outcome: String(doc.outcome),
    score: String(doc.score ?? ""),
    feedback: String(doc.feedback ?? ""),
    publishedAt: String(doc.publishedAt ?? ""),
  }));
}

async function collectInterviewScheduleRows(actor: AppUser) {
  const databases = getServerDatabases();
  const [rounds, participants, applications] = await Promise.all([
    databases.listDocuments<Models.DefaultDocument>(DATABASE_ID, Collections.PLACEMENT_ROUNDS, [
      Query.equal("universityId", actor.universityId),
      Query.limit(500),
    ]),
    databases.listDocuments<Models.DefaultDocument>(DATABASE_ID, Collections.ROUND_PARTICIPANTS, [Query.limit(500)]),
    databases.listDocuments<Models.DefaultDocument>(DATABASE_ID, Collections.APPLICATIONS, [
      Query.equal("universityId", actor.universityId),
      Query.limit(500),
    ]),
  ]);
  const validRoundIds = new Set(rounds.documents.map((doc) => doc.$id));
  const applicationById = new Map(applications.documents.map((doc) => [doc.$id, doc]));
  return participants.documents
    .filter((doc) => validRoundIds.has(String(doc.roundId)))
    .filter((doc) => {
      const application = applicationById.get(String(doc.applicationId));
      return application && String(application.universityId) === actor.universityId;
    })
    .map((doc) => ({
      participantId: doc.$id,
      applicationId: String(doc.applicationId),
      roundId: String(doc.roundId),
      scheduledStart: String(doc.scheduledStart ?? ""),
      scheduledEnd: String(doc.scheduledEnd ?? ""),
      location: String(doc.location ?? ""),
      meetingLink: String(doc.meetingLink ?? ""),
      instructions: String(doc.instructions ?? ""),
      interviewerIds: Array.isArray(doc.interviewerIds) ? doc.interviewerIds.join("\n") : "",
    }));
}

function serializeDelimitedTable(rows: Record<string, string>[], format: ImportExportFormat): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const allRows = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))];
  const delimiter = format === "csv" ? "," : "\t";
  return allRows.map((cells) => cells.map((cell) => escapeCell(cell, format)).join(delimiter)).join("\n");
}

function escapeCell(value: string, format: ImportExportFormat): string {
  if (format === "tsv") return value.replaceAll("\t", " ");
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }
  return value;
}

async function savePreview(preview: StoredImportPreview) {
  await mkdir(PREVIEW_DIR, { recursive: true });
  await writeFile(path.join(PREVIEW_DIR, `${preview.previewId}.json`), JSON.stringify(preview, null, 2), "utf8");
}

async function loadPreview(previewId: string): Promise<StoredImportPreview> {
  const raw = await readFile(path.join(PREVIEW_DIR, `${previewId}.json`), "utf8");
  return JSON.parse(raw) as StoredImportPreview;
}

function toPreviewResult(preview: StoredImportPreview): ImportPreviewResult {
  return {
    previewId: preview.previewId,
    entity: preview.entity,
    fileName: preview.fileName,
    format: preview.format,
    totalRows: preview.rows.length,
    readyRows: preview.rows.filter((row) => row.status === "ready").length,
    errorCount: preview.rows.filter((row) => row.status === "failed").length,
    rows: preview.rows,
  };
}

function assertPreviewScope(actor: AppUser, preview: StoredImportPreview) {
  if (preview.actorId !== actor.$id || preview.universityId !== actor.universityId) {
    throw AppError.forbidden("You do not have access to this import preview.");
  }
}

async function saveErrorReport(entity: ImportExportEntity, rows: ImportRowResult[]): Promise<string> {
  const reportId = randomUUID();
  const content = serializeDelimitedTable(rows.map((row) => ({
    rowNumber: String(row.rowNumber),
    identifier: row.identifier,
    reason: row.reason ?? "",
    ...row.values,
  })), "tsv");
  await mkdir(PREVIEW_DIR, { recursive: true });
  await writeFile(path.join(PREVIEW_DIR, `${reportId}.report.tsv`), content, "utf8");
  return reportId;
}

async function resolveUserIdByEmail(universityId: string, email: string): Promise<string> {
  const databases = getServerDatabases();
  const result = await databases.listDocuments<Models.DefaultDocument>(DATABASE_ID, Collections.USERS, [
    Query.equal("universityId", universityId),
    Query.equal("email", email),
    Query.limit(1),
  ]);
  const doc = result.documents[0];
  if (!doc) throw AppError.notFound(`Student user not found for email ${email}.`);
  return doc.$id;
}

async function resolveCompanyId(actor: AppUser, companyName: string): Promise<string> {
  if (!companyName) throw AppError.validationError("companyName is required when companyId is missing.");
  const companies = await listCompaniesForAdmin(actor, { search: companyName, status: "all", page: 1 });
  const match = companies.items.find((company) => company.name.toLowerCase() === companyName.toLowerCase());
  if (!match) throw AppError.notFound(`Company not found for name ${companyName}.`);
  return match.$id;
}

async function resolveParticipantId(applicationId: string, roundId: string): Promise<string> {
  const databases = getServerDatabases();
  const result = await databases.listDocuments<Models.DefaultDocument>(DATABASE_ID, Collections.ROUND_PARTICIPANTS, [
    Query.equal("applicationId", applicationId),
    Query.equal("roundId", roundId),
    Query.limit(1),
  ]);
  const doc = result.documents[0];
  if (!doc) throw AppError.notFound(`Round participant not found for application ${applicationId} and round ${roundId}.`);
  return doc.$id;
}

function splitMultiline(value: string): string[] {
  return value
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function asNumber(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asInteger(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asBoolean(value: string): boolean | undefined {
  if (!value) return undefined;
  if (["true", "yes", "1"].includes(value.toLowerCase())) return true;
  if (["false", "no", "0"].includes(value.toLowerCase())) return false;
  return undefined;
}
