import { ID, Models, Query } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { Buckets, Collections, DATABASE_ID } from "@/lib/appwrite/constants";
import { createServerServices } from "@/lib/appwrite/server";
import { USER_ROLES } from "@/lib/auth/roles";
import { AppError, isNotFoundError } from "@/lib/errors";
import type { AppUser, DocumentMetadata, Resume, ResumeStatus } from "@/types";

const MAX_RESUME_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_RESUME_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const RESUME_ENTITY_TYPE = "resume";

export interface ResumeWithMetadata {
  resume: Resume;
  metadata: DocumentMetadata | null;
}

export interface ResumeSummary {
  currentResume: ResumeWithMetadata | null;
  history: ResumeWithMetadata[];
}

export interface SubmittedResumeRecord extends ResumeWithMetadata {
  studentUserId: string;
  studentName: string;
  studentEmail: string;
}

export async function getResumeSummaryForActor(
  actor: AppUser,
  targetUserId = actor.$id
): Promise<ResumeSummary> {
  const student = await readStudentOwner(targetUserId);
  assertCanAccessStudentResumes(actor, student);
  return listResumeSummaryByStudent(student.$id);
}

export async function uploadResumeForActor(
  actor: AppUser,
  file: File
): Promise<ResumeSummary> {
  if (actor.role !== USER_ROLES.STUDENT) {
    throw AppError.forbidden("Only students can upload resumes.");
  }

  validateResumeFile(file);

  const student = await readStudentOwner(actor.$id);
  const { databases, storage } = createServerServices();
  const existing = await listResumeDocuments(student.$id);
  const nextVersion = existing.reduce((max, item) => Math.max(max, item.version), 0) + 1;
  const now = new Date().toISOString();
  const fileId = ID.unique();
  const bytes = Buffer.from(await file.arrayBuffer());

  await storage.createFile(
    Buckets.RESUMES,
    fileId,
    InputFile.fromBuffer(bytes, sanitizeFileName(file.name))
  );

  const resumeId = ID.unique();
  const payload = {
    studentId: student.$id,
    universityId: student.universityId,
    fileId,
    fileName: sanitizeFileName(file.name),
    fileSize: file.size,
    mimeType: file.type || inferMimeTypeFromName(file.name),
    version: nextVersion,
    isCurrent: true,
    status: "UNVERIFIED" as ResumeStatus,
    rejectionReason: null,
    verifiedBy: null,
    verifiedAt: null,
    uploadedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  for (const previous of existing.filter((item) => item.isCurrent)) {
    await databases.updateDocument(DATABASE_ID, Collections.RESUMES, previous.$id, {
      isCurrent: false,
      updatedAt: now,
    });
  }

  await databases.createDocument(DATABASE_ID, Collections.RESUMES, resumeId, payload);
  await createDocumentMetadata({
    universityId: student.universityId,
    ownerUserId: student.userId,
    entityId: resumeId,
    fileId,
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    fileSize: payload.fileSize,
    createdAt: now,
  });

  return listResumeSummaryByStudent(student.$id);
}

export async function submitResumeForVerification(
  actor: AppUser,
  resumeId: string
): Promise<Resume> {
  if (actor.role !== USER_ROLES.STUDENT) {
    throw AppError.forbidden("Only students can submit resumes.");
  }

  const student = await readStudentOwner(actor.$id);
  const resume = await readResume(resumeId);
  assertResumeOwnership(student, resume);

  if (resume.status === "PENDING") {
    return resume;
  }

  if (resume.status === "VERIFIED") {
    throw AppError.conflict("This resume is already verified.");
  }

  return updateResume(resume.$id, {
    status: "PENDING",
    rejectionReason: null,
    verifiedBy: null,
    verifiedAt: null,
  });
}

export async function deleteResumeForActor(
  actor: AppUser,
  resumeId: string
): Promise<ResumeSummary> {
  const student = await readStudentOwner(actor.$id);
  const resume = await readResume(resumeId);
  assertResumeOwnership(student, resume);

  const { databases, storage } = createServerServices();
  await databases.deleteDocument(DATABASE_ID, Collections.RESUMES, resume.$id);
  await deleteDocumentMetadataForEntity(resume.$id);

  try {
    await storage.deleteFile(Buckets.RESUMES, resume.fileId);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  const remaining = await listResumeDocuments(student.$id);
  if (resume.isCurrent && remaining.length > 0) {
    const nextCurrent = remaining
      .slice()
      .sort((left, right) => right.version - left.version)[0];
    await databases.updateDocument(DATABASE_ID, Collections.RESUMES, nextCurrent.$id, {
      isCurrent: true,
      updatedAt: new Date().toISOString(),
    });
  }

  return listResumeSummaryByStudent(student.$id);
}

export async function verifyResumeForAdmin(
  actor: AppUser,
  resumeId: string
): Promise<Resume> {
  const resume = await readResume(resumeId);
  assertCanManageResume(actor, resume.universityId);
  return updateResume(resumeId, {
    status: "VERIFIED",
    rejectionReason: null,
    verifiedBy: actor.$id,
    verifiedAt: new Date().toISOString(),
  });
}

export async function rejectResumeForAdmin(
  actor: AppUser,
  resumeId: string,
  rejectionReason: string
): Promise<Resume> {
  const reason = rejectionReason.trim();
  if (!reason) {
    throw AppError.validationError("Rejection reason is required.");
  }

  const resume = await readResume(resumeId);
  assertCanManageResume(actor, resume.universityId);
  return updateResume(resumeId, {
    status: "REJECTED",
    rejectionReason: reason,
    verifiedBy: actor.$id,
    verifiedAt: new Date().toISOString(),
  });
}

export async function listSubmittedResumesForAdmin(
  actor: AppUser
): Promise<SubmittedResumeRecord[]> {
  if (actor.role !== USER_ROLES.PLACEMENT_ADMIN && actor.role !== USER_ROLES.SUPER_ADMIN) {
    throw AppError.forbidden("Admin access is required.");
  }

  const { databases } = createServerServices();
  const queries = [Query.equal("status", "PENDING"), Query.orderDesc("uploadedAt"), Query.limit(100)];
  if (actor.role !== USER_ROLES.SUPER_ADMIN) {
    queries.unshift(Query.equal("universityId", actor.universityId));
  }

  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.RESUMES,
    queries
  );

  const rows = await Promise.all(
    result.documents.map(async (doc) => {
      const resume = docToResume(doc);
      const student = await readStudentByProfileId(resume.studentId);
      const metadata = await readDocumentMetadataForEntity(resume.$id);
      return {
        resume,
        metadata,
        studentUserId: student.$id,
        studentName: student.name,
        studentEmail: student.email,
      };
    })
  );

  return rows;
}

export async function getResumeFileForActor(
  actor: AppUser,
  resumeId: string
): Promise<{ resume: Resume; file: ArrayBuffer }> {
  const resume = await readResume(resumeId);
  await assertCanReadResumeBinary(actor, resume);
  const { storage } = createServerServices();
  const file = await storage.getFileDownload(Buckets.RESUMES, resume.fileId);
  return { resume, file };
}

function validateResumeFile(file: File): void {
  const mimeType = file.type || inferMimeTypeFromName(file.name);
  if (!ALLOWED_RESUME_MIME_TYPES.has(mimeType)) {
    throw AppError.validationError("Resume must be a PDF, DOC, or DOCX file.");
  }
  if (file.size <= 0) {
    throw AppError.validationError("Resume file is empty.");
  }
  if (file.size > MAX_RESUME_FILE_SIZE_BYTES) {
    throw AppError.validationError("Resume file must be 5 MB or smaller.");
  }
}

async function listResumeSummaryByStudent(studentId: string): Promise<ResumeSummary> {
  const history = await listResumeDocuments(studentId);
  const enriched = await Promise.all(
    history
      .sort((left, right) => right.version - left.version)
      .map(async (resume) => ({
        resume,
        metadata: await readDocumentMetadataForEntity(resume.$id),
      }))
  );

  return {
    currentResume: enriched.find((item) => item.resume.isCurrent) ?? null,
    history: enriched,
  };
}

async function listResumeDocuments(studentId: string): Promise<Resume[]> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.RESUMES,
    [Query.equal("studentId", studentId), Query.limit(100)]
  );
  return result.documents.map(docToResume);
}

async function readResume(resumeId: string): Promise<Resume> {
  const { databases } = createServerServices();
  try {
    const doc = await databases.getDocument<Models.DefaultDocument>(
      DATABASE_ID,
      Collections.RESUMES,
      resumeId
    );
    return docToResume(doc);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw AppError.notFound("Resume not found.");
    }
    throw error;
  }
}

async function updateResume(resumeId: string, patch: Record<string, unknown>): Promise<Resume> {
  const { databases } = createServerServices();
  const updated = await databases.updateDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.RESUMES,
    resumeId,
    {
      ...patch,
      updatedAt: new Date().toISOString(),
    }
  );
  return docToResume(updated);
}

async function createDocumentMetadata(input: {
  universityId: string;
  ownerUserId: string;
  entityId: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}): Promise<void> {
  const { databases } = createServerServices();
  await databases.createDocument(DATABASE_ID, "document_metadata", ID.unique(), {
    universityId: input.universityId,
    ownerUserId: input.ownerUserId,
    entityType: RESUME_ENTITY_TYPE,
    entityId: input.entityId,
    bucketId: Buckets.RESUMES,
    fileId: input.fileId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    checksum: null,
    tags: ["resume"],
    isPrivate: true,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

async function readDocumentMetadataForEntity(entityId: string): Promise<DocumentMetadata | null> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    "document_metadata",
    [Query.equal("entityType", RESUME_ENTITY_TYPE), Query.equal("entityId", entityId), Query.limit(1)]
  );
  const doc = result.documents[0];
  return doc ? docToDocumentMetadata(doc) : null;
}

async function deleteDocumentMetadataForEntity(entityId: string): Promise<void> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    "document_metadata",
    [Query.equal("entityType", RESUME_ENTITY_TYPE), Query.equal("entityId", entityId), Query.limit(10)]
  );

  await Promise.all(
    result.documents.map((doc) =>
      databases.deleteDocument(DATABASE_ID, "document_metadata", doc.$id)
    )
  );
}

async function readStudentOwner(userId: string): Promise<{ $id: string; userId: string; universityId: string }> {
  const { databases } = createServerServices();
  try {
    const doc = await databases.getDocument<Models.DefaultDocument>(
      DATABASE_ID,
      Collections.STUDENT_PROFILES,
      userId
    );
    return {
      $id: doc.$id,
      userId: String(doc.userId),
      universityId: String(doc.universityId),
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      throw AppError.notFound("Student profile not found.");
    }
    throw error;
  }
}

async function readStudentByProfileId(profileId: string): Promise<AppUser> {
  const student = await readStudentOwner(profileId);
  const { databases } = createServerServices();
  const doc = await databases.getDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.USERS,
    student.userId
  );
  return {
    $id: doc.$id,
    name: String(doc.name),
    email: String(doc.email),
    universityId: String(doc.universityId),
    role: doc.role as AppUser["role"],
    isActive: Boolean(doc.isActive),
    onboardingCompletedAt: doc.onboardingCompletedAt as string | undefined,
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

function assertCanAccessStudentResumes(
  actor: AppUser,
  student: { userId: string; universityId: string }
): void {
  if (actor.$id === student.userId) {
    return;
  }
  assertCanManageResume(actor, student.universityId);
}

function assertCanManageResume(actor: AppUser, universityId: string): void {
  if (actor.role === USER_ROLES.SUPER_ADMIN) {
    return;
  }
  if (actor.role === USER_ROLES.PLACEMENT_ADMIN && actor.universityId === universityId) {
    return;
  }
  throw AppError.forbidden("You do not have access to this resume.");
}

function assertResumeOwnership(
  student: { $id: string },
  resume: Resume
): void {
  if (resume.studentId !== student.$id) {
    throw AppError.forbidden("You do not have access to this resume.");
  }
}

async function assertCanReadResumeBinary(actor: AppUser, resume: Resume): Promise<void> {
  if (actor.role === USER_ROLES.STUDENT) {
    const student = await readStudentOwner(actor.$id);
    assertResumeOwnership(student, resume);
    return;
  }
  assertCanManageResume(actor, resume.universityId);
}

function docToResume(doc: Models.DefaultDocument): Resume {
  return {
    $id: doc.$id,
    studentId: String(doc.studentId),
    universityId: String(doc.universityId),
    fileId: String(doc.fileId),
    fileName: String(doc.fileName),
    fileSize: Number(doc.fileSize),
    mimeType: String(doc.mimeType),
    version: Number(doc.version),
    isCurrent: Boolean(doc.isCurrent),
    status: doc.status as ResumeStatus,
    rejectionReason: (doc.rejectionReason as string | null) ?? undefined,
    verifiedBy: (doc.verifiedBy as string | null) ?? undefined,
    verifiedAt: (doc.verifiedAt as string | null) ?? undefined,
    uploadedAt: (doc.uploadedAt as string) ?? doc.$createdAt,
  };
}

function docToDocumentMetadata(doc: Models.DefaultDocument): DocumentMetadata {
  return {
    $id: doc.$id,
    universityId: String(doc.universityId),
    ownerUserId: String(doc.ownerUserId),
    entityType: String(doc.entityType),
    entityId: String(doc.entityId),
    bucketId: String(doc.bucketId),
    fileId: String(doc.fileId),
    fileName: String(doc.fileName),
    mimeType: String(doc.mimeType),
    fileSize: Number(doc.fileSize),
    checksum: (doc.checksum as string | null) ?? undefined,
    tags: Array.isArray(doc.tags) ? (doc.tags as string[]) : [],
    isPrivate: Boolean(doc.isPrivate),
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

function sanitizeFileName(fileName: string): string {
  const normalized = fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
  return normalized.length > 0 ? normalized : "resume.pdf";
}

function inferMimeTypeFromName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (lower.endsWith(".doc")) {
    return "application/msword";
  }
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "";
}
