import { ID, Models, Query } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { Buckets, Collections, DATABASE_ID } from "@/lib/appwrite/constants";
import { createServerServices } from "@/lib/appwrite/server";
import { createAuditLog } from "@/lib/audit/service";
import { USER_ROLES } from "@/lib/auth/roles";
import {
  createEligibilityRuleSet,
  previewEligibilityForRole,
  readEligibilityRuleSet,
  updateEligibilityRuleSet,
} from "@/lib/eligibility/service";
import { AppError, isNotFoundError } from "@/lib/errors";
import { dispatchNotificationEvent } from "@/lib/notifications/service";
import type {
  AppUser,
  Company,
  DocumentMetadata,
  EligibilityRuleSet,
  Role,
  RoleExplorerFacets,
  RoleExplorerQuery,
  RoleExplorerResult,
} from "@/types";

const PAGE_SIZE = 10;
const ROLE_EXPLORER_SCAN_LIMIT = 250;
const MAX_LOGO_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_JD_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const ALLOWED_JD_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export interface CompanyFilters {
  search?: string;
  status?: "active" | "archived" | "all";
  page?: number;
}

export type RoleFilters = RoleExplorerQuery;

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CompanyDetail extends Company {
  roles: Role[];
  logoMetadata: DocumentMetadata | null;
}

export interface RoleDetail extends Role {
  company: Company;
  jdMetadata: DocumentMetadata | null;
  eligibilityRuleSet: EligibilityRuleSet | null;
}

export interface CompanyInput {
  name: string;
  website?: string;
  industry?: string;
  description?: string;
  locations?: string[];
  companyType?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface RoleInput {
  companyId: string;
  title: string;
  location?: string;
  workMode?: Role["workMode"];
  employmentType?: Role["employmentType"];
  ctc?: number;
  fixedCtc?: number;
  variableCtc?: number;
  joiningDate?: string;
  numberOfOpenings?: number;
  applicationDeadline?: string;
  description?: string;
  requiredSkills?: string[];
  requiredQualifications?: string[];
  eligibilityRuleName?: string;
  eligibilityRuleDescription?: string;
  eligibilityRuleTree?: EligibilityRuleSet["ruleTree"] | null;
}

export async function listCompaniesForAdmin(
  actor: AppUser,
  filters: CompanyFilters
): Promise<PaginatedResult<Company>> {
  assertAdmin(actor);
  return listCompanies(actor, filters, true);
}

export async function listCompaniesForStudents(
  actor: AppUser,
  filters: CompanyFilters
): Promise<PaginatedResult<Company>> {
  if (actor.role !== USER_ROLES.STUDENT) {
    throw AppError.forbidden("Student access is required.");
  }
  return listCompanies(actor, filters, false);
}

export async function getCompanyDetailForAdmin(actor: AppUser, companyId: string): Promise<CompanyDetail> {
  assertAdmin(actor);
  const company = await readCompany(companyId);
  assertCompanyScope(actor, company);
  return buildCompanyDetail(company, true);
}

export async function getCompanyDetailForStudent(actor: AppUser, companyId: string): Promise<CompanyDetail> {
  const company = await readCompany(companyId);
  if (!company.isActive || company.universityId !== actor.universityId) {
    throw AppError.notFound("Company not found.");
  }
  return buildCompanyDetail(company, false);
}

export async function createCompanyForAdmin(
  actor: AppUser,
  input: CompanyInput,
  logoFile?: File | null
): Promise<Company> {
  assertAdmin(actor);
  const now = new Date().toISOString();
  const payload = normalizeCompanyInput(input);
  const { databases } = createServerServices();
  const companyId = ID.unique();
  const logo = logoFile ? await uploadCompanyLogo(actor, companyId, logoFile) : null;

  const doc = await databases.createDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.COMPANIES,
    companyId,
    {
      universityId: actor.universityId,
      name: payload.name,
      logo: logo?.fileId ?? null,
      website: payload.website ?? null,
      industry: payload.industry ?? null,
      description: payload.description ?? null,
      locations: payload.locations,
      companyType: payload.companyType ?? null,
      contactInfo: payload.contactInfo,
      participationHistory: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }
  );
  const company = docToCompany(doc);
  await createAuditLog(actor, {
    action: "company.created",
    entityType: "company",
    entityId: company.$id,
    newValue: company as unknown as Record<string, unknown>,
  });
  return company;
}

export async function updateCompanyForAdmin(
  actor: AppUser,
  companyId: string,
  input: CompanyInput,
  logoFile?: File | null
): Promise<Company> {
  assertAdmin(actor);
  const company = await readCompany(companyId);
  assertCompanyScope(actor, company);
  const payload = normalizeCompanyInput(input);
  let logoFileId = company.logo;

  if (logoFile) {
    const uploadedLogo = await uploadCompanyLogo(actor, companyId, logoFile);
    logoFileId = uploadedLogo.fileId;
  }

  const { databases } = createServerServices();
  const updated = await databases.updateDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.COMPANIES,
    companyId,
    {
      name: payload.name,
      logo: logoFileId ?? null,
      website: payload.website ?? null,
      industry: payload.industry ?? null,
      description: payload.description ?? null,
      locations: payload.locations,
      companyType: payload.companyType ?? null,
      contactInfo: payload.contactInfo,
      updatedAt: new Date().toISOString(),
    }
  );
  const nextCompany = docToCompany(updated);
  await createAuditLog(actor, {
    action: "company.updated",
    entityType: "company",
    entityId: companyId,
    previousValue: company as unknown as Record<string, unknown>,
    newValue: nextCompany as unknown as Record<string, unknown>,
  });
  return nextCompany;
}

export async function archiveCompanyForAdmin(actor: AppUser, companyId: string): Promise<Company> {
  assertAdmin(actor);
  const company = await readCompany(companyId);
  assertCompanyScope(actor, company);
  const { databases } = createServerServices();
  const updated = await databases.updateDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.COMPANIES,
    companyId,
    { isActive: false, updatedAt: new Date().toISOString() }
  );
  const nextCompany = docToCompany(updated);
  await createAuditLog(actor, {
    action: "company.archived",
    entityType: "company",
    entityId: companyId,
    previousValue: company as unknown as Record<string, unknown>,
    newValue: nextCompany as unknown as Record<string, unknown>,
  });
  return nextCompany;
}

export async function createRoleForAdmin(
  actor: AppUser,
  input: RoleInput,
  jdFile?: File | null
): Promise<Role> {
  assertAdmin(actor);
  const company = await readCompany(input.companyId);
  assertCompanyScope(actor, company);
  const payload = normalizeRoleInput(input);
  const roleId = ID.unique();
  const now = new Date().toISOString();
  const jd = jdFile ? await uploadJdAttachment(actor, roleId, jdFile) : null;
  const { databases } = createServerServices();

  const doc = await databases.createDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.ROLES,
    roleId,
    {
      companyId: company.$id,
      universityId: company.universityId,
      title: payload.title,
      jdText: payload.description ?? null,
      jdAttachmentId: jd?.fileId ?? null,
      location: payload.location ?? null,
      workMode: payload.workMode ?? null,
      employmentType: payload.employmentType ?? null,
      ctc: payload.ctc ?? null,
      fixedCtc: payload.fixedCtc ?? null,
      variableCtc: payload.variableCtc ?? null,
      joiningDate: payload.joiningDate ?? null,
      experienceRequirementMonths: null,
      numberOfOpenings: payload.numberOfOpenings ?? null,
      applicationDeadline: payload.applicationDeadline ?? null,
      selectionProcessDescription: null,
      eligibilityRuleSetId: null,
      requiredSkills: payload.requiredSkills,
      requiredQualifications: payload.requiredQualifications,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    }
  );
  const role = docToRole(doc);
  await createAuditLog(actor, {
    action: "role.created",
    entityType: "role",
    entityId: role.$id,
    newValue: role as unknown as Record<string, unknown>,
  });
  return saveRoleEligibility(actor, role, payload);
}

export async function updateRoleForAdmin(
  actor: AppUser,
  roleId: string,
  input: RoleInput,
  jdFile?: File | null
): Promise<Role> {
  assertAdmin(actor);
  const role = await readRole(roleId);
  assertRoleScope(actor, role);
  const company = await readCompany(input.companyId);
  assertCompanyScope(actor, company);
  const payload = normalizeRoleInput(input);
  let jdAttachmentId = role.jdAttachmentId;

  if (jdFile) {
    const uploadedJd = await uploadJdAttachment(actor, roleId, jdFile);
    jdAttachmentId = uploadedJd.fileId;
  }

  const { databases } = createServerServices();
  const updated = await databases.updateDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.ROLES,
    roleId,
    {
      companyId: company.$id,
      universityId: company.universityId,
      title: payload.title,
      jdText: payload.description ?? null,
      jdAttachmentId: jdAttachmentId ?? null,
      location: payload.location ?? null,
      workMode: payload.workMode ?? null,
      employmentType: payload.employmentType ?? null,
      ctc: payload.ctc ?? null,
      fixedCtc: payload.fixedCtc ?? null,
      variableCtc: payload.variableCtc ?? null,
      joiningDate: payload.joiningDate ?? null,
      numberOfOpenings: payload.numberOfOpenings ?? null,
      applicationDeadline: payload.applicationDeadline ?? null,
      requiredSkills: payload.requiredSkills,
      requiredQualifications: payload.requiredQualifications,
      updatedAt: new Date().toISOString(),
    }
  );
  const nextRole = docToRole(updated);
  await createAuditLog(actor, {
    action: "role.updated",
    entityType: "role",
    entityId: roleId,
    previousValue: role as unknown as Record<string, unknown>,
    newValue: nextRole as unknown as Record<string, unknown>,
  });
  return saveRoleEligibility(actor, nextRole, payload);
}

export async function archiveRoleForAdmin(actor: AppUser, roleId: string): Promise<Role> {
  return changeRoleStatus(actor, roleId, "cancelled");
}

export async function publishRoleForAdmin(actor: AppUser, roleId: string): Promise<Role> {
  return changeRoleStatus(actor, roleId, "published");
}

export async function closeRoleForAdmin(actor: AppUser, roleId: string): Promise<Role> {
  return changeRoleStatus(actor, roleId, "closed");
}

export async function duplicateRoleForAdmin(actor: AppUser, roleId: string): Promise<Role> {
  assertAdmin(actor);
  const role = await readRole(roleId);
  assertRoleScope(actor, role);
  const { databases } = createServerServices();
  const now = new Date().toISOString();
  const duplicated = await databases.createDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.ROLES,
    ID.unique(),
    {
      companyId: role.companyId,
      universityId: role.universityId,
      title: `${role.title} Copy`,
      jdText: role.jdText ?? null,
      jdAttachmentId: role.jdAttachmentId ?? null,
      location: role.location ?? null,
      workMode: role.workMode ?? null,
      employmentType: role.employmentType ?? null,
      ctc: role.ctc ?? null,
      fixedCtc: role.fixedCtc ?? null,
      variableCtc: role.variableCtc ?? null,
      joiningDate: role.joiningDate ?? null,
      experienceRequirementMonths: null,
      numberOfOpenings: role.numberOfOpenings ?? null,
      applicationDeadline: role.applicationDeadline ?? null,
      selectionProcessDescription: role.selectionProcessDescription ?? null,
      eligibilityRuleSetId: null,
      requiredSkills: role.requiredSkills,
      requiredQualifications: role.requiredQualifications,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    }
  );
  const copiedRole = docToRole(duplicated);
  await createAuditLog(actor, {
    action: "role.duplicated",
    entityType: "role",
    entityId: copiedRole.$id,
    previousValue: role as unknown as Record<string, unknown>,
    newValue: copiedRole as unknown as Record<string, unknown>,
  });
  return copiedRole;
}

export async function listRolesForAdmin(
  actor: AppUser,
  filters: RoleFilters
): Promise<PaginatedResult<RoleDetail>> {
  assertAdmin(actor);
  const result = await listRoles(actor, filters, true);
  return {
    items: result.items,
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  };
}

export async function listRolesForStudents(
  actor: AppUser,
  filters: RoleFilters
): Promise<PaginatedResult<RoleDetail>> {
  if (actor.role !== USER_ROLES.STUDENT) {
    throw AppError.forbidden("Student access is required.");
  }
  const result = await listRoles(actor, filters, false);
  return {
    items: result.items,
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  };
}

export async function listRoleExplorerForStudents(
  actor: AppUser,
  query: RoleExplorerQuery
): Promise<RoleExplorerResult<RoleDetail>> {
  if (actor.role !== USER_ROLES.STUDENT) {
    throw AppError.forbidden("Student access is required.");
  }
  return listRoles(actor, query, false);
}

export async function getRoleDetailForAdmin(actor: AppUser, roleId: string): Promise<RoleDetail> {
  assertAdmin(actor);
  const role = await readRole(roleId);
  assertRoleScope(actor, role);
  return buildRoleDetail(role);
}

export async function getRoleDetailForStudent(actor: AppUser, roleId: string): Promise<RoleDetail> {
  const role = await readRole(roleId);
  if (role.universityId !== actor.universityId || role.status !== "published") {
    throw AppError.notFound("Role not found.");
  }
  return buildRoleDetail(role);
}

async function listCompanies(
  actor: AppUser,
  filters: CompanyFilters,
  includeArchived: boolean
): Promise<PaginatedResult<Company>> {
  const page = normalizePage(filters.page);
  const search = filters.search?.trim().toLowerCase();
  const status = filters.status ?? (includeArchived ? "all" : "active");
  const { databases } = createServerServices();
  const queries = [Query.equal("universityId", actor.universityId), Query.limit(100)];
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.COMPANIES,
    queries
  );

  let items = result.documents.map(docToCompany);
  if (!includeArchived || status === "active") {
    items = items.filter((item) => item.isActive);
  } else if (status === "archived") {
    items = items.filter((item) => !item.isActive);
  }
  if (search) {
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(search) ||
        item.industry?.toLowerCase().includes(search) ||
        item.locations.some((location) => location.toLowerCase().includes(search))
    );
  }
  items.sort((left, right) => left.name.localeCompare(right.name));

  return paginate(items, page);
}

async function listRoles(
  actor: AppUser,
  filters: RoleFilters,
  includeNonPublished: boolean
): Promise<RoleExplorerResult<RoleDetail>> {
  const page = normalizePage(filters.page);
  const search = filters.search?.trim().toLowerCase();
  const status = filters.status ?? (includeNonPublished ? "all" : "published");
  const sortBy = filters.sortBy ?? "deadline";
  const sortDirection = filters.sortDirection ?? "asc";
  const { databases } = createServerServices();
  const queries = [Query.equal("universityId", actor.universityId), Query.limit(ROLE_EXPLORER_SCAN_LIMIT)];
  if (status !== "all") {
    queries.push(Query.equal("status", status));
  }
  if (filters.companyId) {
    queries.push(Query.equal("companyId", filters.companyId));
  }
  if (filters.workMode) {
    queries.push(Query.equal("workMode", filters.workMode));
  }
  if (filters.employmentType) {
    queries.push(Query.equal("employmentType", filters.employmentType));
  }

  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.ROLES,
    queries
  );

  let roles = result.documents.map(docToRole);
  if (!includeNonPublished) {
    roles = roles.filter((role) => role.status === "published");
  } else if (status !== "all") {
    roles = roles.filter((role) => role.status === status);
  }
  if (search) {
    roles = roles.filter(
      (role) =>
        role.title.toLowerCase().includes(search) ||
        role.location?.toLowerCase().includes(search) ||
        role.requiredSkills.some((skill) => skill.toLowerCase().includes(search))
    );
  }
  const facets = buildRoleExplorerFacets(roles);
  roles.sort((left, right) => compareRoles(left, right, sortBy, sortDirection));

  const paginated = paginate(roles, page);
  const items = await Promise.all(paginated.items.map(buildRoleDetail));
  return {
    ...paginated,
    items,
    facets,
    appliedQuery: {
      search: filters.search?.trim() || undefined,
      status,
      companyId: filters.companyId,
      workMode: filters.workMode,
      employmentType: filters.employmentType,
      sortBy,
      sortDirection,
      page,
    },
  };
}

async function buildCompanyDetail(company: Company, includeNonPublishedRoles: boolean): Promise<CompanyDetail> {
  const { databases } = createServerServices();
  const rolesResult = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.ROLES,
    [Query.equal("companyId", company.$id), Query.limit(100)]
  );
  let roles = rolesResult.documents.map(docToRole);
  if (!includeNonPublishedRoles) {
    roles = roles.filter((role) => role.status === "published");
  }
  roles.sort((left, right) => left.title.localeCompare(right.title));
  return {
    ...company,
    roles,
    logoMetadata: company.logo ? await readDocumentMetadata("company_logo", company.$id) : null,
  };
}

async function buildRoleDetail(role: Role): Promise<RoleDetail> {
  const company = await readCompany(role.companyId);
  return {
    ...role,
    company,
    jdMetadata: role.jdAttachmentId ? await readDocumentMetadata("role_jd", role.$id) : null,
    eligibilityRuleSet: role.eligibilityRuleSetId ? await readEligibilityRuleSet(role.eligibilityRuleSetId) : null,
  };
}

export async function previewRoleEligibilityForAdmin(
  actor: AppUser,
  input: {
    roleId?: string;
    currentRuleTree?: EligibilityRuleSet["ruleTree"] | null;
    draftRuleTree?: EligibilityRuleSet["ruleTree"] | null;
  }
) {
  assertAdmin(actor);
  let currentRuleTree = input.currentRuleTree ?? null;

  if (input.roleId) {
    const role = await readRole(input.roleId);
    assertRoleScope(actor, role);
    if (!input.currentRuleTree && role.eligibilityRuleSetId) {
      const ruleSet = await readEligibilityRuleSet(role.eligibilityRuleSetId);
      currentRuleTree = ruleSet?.ruleTree ?? null;
    }
  }

  return previewEligibilityForRole(actor, currentRuleTree, input.draftRuleTree ?? null);
}

async function changeRoleStatus(actor: AppUser, roleId: string, status: Role["status"]): Promise<Role> {
  assertAdmin(actor);
  const role = await readRole(roleId);
  assertRoleScope(actor, role);
  const company = await readCompany(role.companyId);
  const { databases } = createServerServices();
  const updated = await databases.updateDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.ROLES,
    roleId,
    { status, updatedAt: new Date().toISOString() }
  );
  const nextRole = docToRole(updated);
  await createAuditLog(actor, {
    action: status === "published" ? "company.published" : "role.status_changed",
    entityType: status === "published" ? "company_publication" : "role",
    entityId: roleId,
    previousValue: { status: role.status, roleId: role.$id, companyId: role.companyId },
    newValue: { status: nextRole.status, roleId: nextRole.$id, companyId: nextRole.companyId },
  });

  if (status === "published" && role.status !== "published") {
    await dispatchNotificationEvent({
      type: "COMPANY_PUBLISHED",
      universityId: role.universityId,
      entityId: role.$id,
      entityType: "role",
      dedupeKey: `role-published:${role.$id}:${updated.$updatedAt ?? nextRole.updatedAt}`,
      variables: {
        company_name: company.name,
        role_name: nextRole.title,
        deadline: nextRole.applicationDeadline ?? "Open deadline",
      },
    });
  }

  return nextRole;
}

async function uploadCompanyLogo(
  actor: AppUser,
  companyId: string,
  file: File
): Promise<{ fileId: string }> {
  validateFile(file, ALLOWED_LOGO_MIME_TYPES, MAX_LOGO_FILE_SIZE_BYTES, "Logo");
  const fileId = ID.unique();
  const { storage } = createServerServices();
  const bytes = Buffer.from(await file.arrayBuffer());
  await storage.createFile(
    Buckets.COMPANY_LOGOS,
    fileId,
    InputFile.fromBuffer(bytes, sanitizeFileName(file.name))
  );
  await upsertDocumentMetadata({
    entityType: "company_logo",
    entityId: companyId,
    ownerUserId: actor.$id,
    universityId: actor.universityId,
    bucketId: Buckets.COMPANY_LOGOS,
    fileId,
    fileName: sanitizeFileName(file.name),
    mimeType: file.type,
    fileSize: file.size,
  });
  return { fileId };
}

async function uploadJdAttachment(
  actor: AppUser,
  roleId: string,
  file: File
): Promise<{ fileId: string }> {
  validateFile(file, ALLOWED_JD_MIME_TYPES, MAX_JD_FILE_SIZE_BYTES, "JD");
  const fileId = ID.unique();
  const { storage } = createServerServices();
  const bytes = Buffer.from(await file.arrayBuffer());
  await storage.createFile(
    Buckets.JD_ATTACHMENTS,
    fileId,
    InputFile.fromBuffer(bytes, sanitizeFileName(file.name))
  );
  await upsertDocumentMetadata({
    entityType: "role_jd",
    entityId: roleId,
    ownerUserId: actor.$id,
    universityId: actor.universityId,
    bucketId: Buckets.JD_ATTACHMENTS,
    fileId,
    fileName: sanitizeFileName(file.name),
    mimeType: file.type,
    fileSize: file.size,
  });
  return { fileId };
}

export async function getStorageFileForActor(
  actor: AppUser,
  entityType: "company_logo" | "role_jd",
  entityId: string
): Promise<{ metadata: DocumentMetadata; file: ArrayBuffer }> {
  const metadata = await readDocumentMetadata(entityType, entityId);
  if (!metadata) {
    throw AppError.notFound("File not found.");
  }
  if (actor.role === USER_ROLES.STUDENT && actor.universityId !== metadata.universityId) {
    throw AppError.forbidden("You do not have access to this file.");
  }
  if (actor.role !== USER_ROLES.STUDENT && actor.role !== USER_ROLES.SUPER_ADMIN && actor.universityId !== metadata.universityId) {
    throw AppError.forbidden("You do not have access to this file.");
  }
  const { storage } = createServerServices();
  const file = await storage.getFileDownload(metadata.bucketId, metadata.fileId);
  return { metadata, file };
}

async function readCompany(companyId: string): Promise<Company> {
  const { databases } = createServerServices();
  try {
    const doc = await databases.getDocument<Models.DefaultDocument>(DATABASE_ID, Collections.COMPANIES, companyId);
    return docToCompany(doc);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw AppError.notFound("Company not found.");
    }
    throw error;
  }
}

async function readRole(roleId: string): Promise<Role> {
  const { databases } = createServerServices();
  try {
    const doc = await databases.getDocument<Models.DefaultDocument>(DATABASE_ID, Collections.ROLES, roleId);
    return docToRole(doc);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw AppError.notFound("Role not found.");
    }
    throw error;
  }
}

async function readDocumentMetadata(entityType: string, entityId: string): Promise<DocumentMetadata | null> {
  const { databases } = createServerServices();
  const result = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    "document_metadata",
    [Query.equal("entityType", entityType), Query.equal("entityId", entityId), Query.limit(1)]
  );
  const doc = result.documents[0];
  return doc ? docToDocumentMetadata(doc) : null;
}

async function upsertDocumentMetadata(input: {
  entityType: string;
  entityId: string;
  ownerUserId: string;
  universityId: string;
  bucketId: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<void> {
  const { databases } = createServerServices();
  const existing = await databases.listDocuments<Models.DefaultDocument>(
    DATABASE_ID,
    "document_metadata",
    [Query.equal("entityType", input.entityType), Query.equal("entityId", input.entityId), Query.limit(1)]
  );
  const now = new Date().toISOString();
  const payload = {
    universityId: input.universityId,
    ownerUserId: input.ownerUserId,
    entityType: input.entityType,
    entityId: input.entityId,
    bucketId: input.bucketId,
    fileId: input.fileId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    checksum: null,
    tags: [input.entityType],
    isPrivate: input.entityType === "role_jd",
    createdAt: now,
    updatedAt: now,
  };

  if (existing.documents[0]) {
    await databases.updateDocument(DATABASE_ID, "document_metadata", existing.documents[0].$id, {
      ...payload,
      createdAt: existing.documents[0].createdAt ?? existing.documents[0].$createdAt,
    });
    return;
  }

  await databases.createDocument(DATABASE_ID, "document_metadata", ID.unique(), payload);
}

function assertAdmin(actor: AppUser): void {
  if (actor.role !== USER_ROLES.PLACEMENT_ADMIN && actor.role !== USER_ROLES.SUPER_ADMIN) {
    throw AppError.forbidden("Admin access is required.");
  }
}

function assertCompanyScope(actor: AppUser, company: Company): void {
  if (actor.role === USER_ROLES.SUPER_ADMIN) {
    return;
  }
  if (company.universityId !== actor.universityId) {
    throw AppError.forbidden("You do not have access to this company.");
  }
}

function assertRoleScope(actor: AppUser, role: Role): void {
  if (actor.role === USER_ROLES.SUPER_ADMIN) {
    return;
  }
  if (role.universityId !== actor.universityId) {
    throw AppError.forbidden("You do not have access to this role.");
  }
}

function normalizeCompanyInput(input: CompanyInput): {
  name: string;
  website?: string;
  industry?: string;
  description?: string;
  locations: string[];
  companyType?: string;
  contactInfo: Record<string, string>;
} {
  const name = input.name.trim();
  if (!name) {
    throw AppError.validationError("Company name is required.");
  }
  return {
    name,
    website: cleanOptional(input.website),
    industry: cleanOptional(input.industry),
    description: cleanOptional(input.description),
    locations: (input.locations ?? []).map((item) => item.trim()).filter(Boolean),
    companyType: cleanOptional(input.companyType),
    contactInfo: {
      ...(cleanOptional(input.contactName) ? { name: cleanOptional(input.contactName)! } : {}),
      ...(cleanOptional(input.contactEmail) ? { email: cleanOptional(input.contactEmail)! } : {}),
      ...(cleanOptional(input.contactPhone) ? { phone: cleanOptional(input.contactPhone)! } : {}),
    },
  };
}

function normalizeRoleInput(input: RoleInput): {
  companyId: string;
  title: string;
  location?: string;
  workMode?: Role["workMode"];
  employmentType?: Role["employmentType"];
  ctc?: number;
  fixedCtc?: number;
  variableCtc?: number;
  joiningDate?: string;
  numberOfOpenings?: number;
  applicationDeadline?: string;
  description?: string;
  requiredSkills: string[];
  requiredQualifications: string[];
  eligibilityRuleName?: string;
  eligibilityRuleDescription?: string;
  eligibilityRuleTree?: EligibilityRuleSet["ruleTree"] | null;
} {
  const title = input.title.trim();
  if (!title) {
    throw AppError.validationError("Role title is required.");
  }
  return {
    companyId: input.companyId,
    title,
    location: cleanOptional(input.location),
    workMode: input.workMode,
    employmentType: input.employmentType,
    ctc: normalizeNumber(input.ctc),
    fixedCtc: normalizeNumber(input.fixedCtc),
    variableCtc: normalizeNumber(input.variableCtc),
    joiningDate: cleanOptional(input.joiningDate),
    numberOfOpenings: normalizeInteger(input.numberOfOpenings),
    applicationDeadline: cleanOptional(input.applicationDeadline),
    description: cleanOptional(input.description),
    requiredSkills: (input.requiredSkills ?? []).map((item) => item.trim()).filter(Boolean),
    requiredQualifications: (input.requiredQualifications ?? []).map((item) => item.trim()).filter(Boolean),
    eligibilityRuleName: cleanOptional(input.eligibilityRuleName),
    eligibilityRuleDescription: cleanOptional(input.eligibilityRuleDescription),
    eligibilityRuleTree: input.eligibilityRuleTree ?? null,
  };
}

function validateFile(file: File, allowedTypes: Set<string>, maxSize: number, label: string): void {
  if (!allowedTypes.has(file.type)) {
    throw AppError.validationError(`${label} file type is not supported.`);
  }
  if (file.size <= 0 || file.size > maxSize) {
    throw AppError.validationError(`${label} file must be smaller than ${Math.round(maxSize / (1024 * 1024))} MB.`);
  }
}

function paginate<T>(items: T[], page: number): PaginatedResult<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const normalizedPage = Math.min(page, totalPages);
  const start = (normalizedPage - 1) * PAGE_SIZE;
  return {
    items: items.slice(start, start + PAGE_SIZE),
    page: normalizedPage,
    pageSize: PAGE_SIZE,
    total,
    totalPages,
  };
}

function compareRoles(
  left: Role,
  right: Role,
  sortBy: NonNullable<RoleExplorerQuery["sortBy"]>,
  sortDirection: NonNullable<RoleExplorerQuery["sortDirection"]>
): number {
  const multiplier = sortDirection === "desc" ? -1 : 1;

  if (sortBy === "recent") {
    return (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) * multiplier;
  }
  if (sortBy === "ctc") {
    const leftValue = left.ctc ?? Number.MIN_SAFE_INTEGER;
    const rightValue = right.ctc ?? Number.MIN_SAFE_INTEGER;
    return (leftValue - rightValue) * multiplier;
  }

  const leftDeadline = left.applicationDeadline
    ? new Date(left.applicationDeadline).getTime()
    : Number.MAX_SAFE_INTEGER;
  const rightDeadline = right.applicationDeadline
    ? new Date(right.applicationDeadline).getTime()
    : Number.MAX_SAFE_INTEGER;
  return (leftDeadline - rightDeadline) * multiplier;
}

function buildRoleExplorerFacets(roles: Role[]): RoleExplorerFacets {
  const statusCounts = new Map<string, number>();
  const companyCounts = new Map<string, number>();
  const workModeCounts = new Map<string, number>();
  const employmentTypeCounts = new Map<string, number>();

  for (const role of roles) {
    incrementFacet(statusCounts, role.status);
    incrementFacet(companyCounts, role.companyId);
    if (role.workMode) {
      incrementFacet(workModeCounts, role.workMode);
    }
    if (role.employmentType) {
      incrementFacet(employmentTypeCounts, role.employmentType);
    }
  }

  return {
    status: facetMapToValues(statusCounts),
    company: facetMapToValues(companyCounts),
    workMode: facetMapToValues(workModeCounts),
    employmentType: facetMapToValues(employmentTypeCounts),
  };
}

function incrementFacet(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function facetMapToValues(map: Map<string, number>): { value: string; count: number }[] {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value, count]) => ({ value, count }));
}

function normalizePage(page?: number): number {
  return Number.isFinite(page) && page && page > 0 ? Math.floor(page) : 1;
}

function cleanOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeNumber(value?: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeInteger(value?: number): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function sanitizeFileName(value: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
  return cleaned || "file";
}

function docToCompany(doc: Models.DefaultDocument): Company {
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

function docToRole(doc: Models.DefaultDocument): Role {
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

async function saveRoleEligibility(
  actor: AppUser,
  role: Role,
  input: {
    eligibilityRuleName?: string;
    eligibilityRuleDescription?: string;
    eligibilityRuleTree?: EligibilityRuleSet["ruleTree"] | null;
  }
): Promise<Role> {
  const hasRuleTree = input.eligibilityRuleTree && !(input.eligibilityRuleTree.type === "group" && input.eligibilityRuleTree.children.length === 0);
  const { databases } = createServerServices();

  if (!hasRuleTree) {
    if (!role.eligibilityRuleSetId) {
      return role;
    }
    const updated = await databases.updateDocument<Models.DefaultDocument>(
      DATABASE_ID,
      Collections.ROLES,
      role.$id,
      {
        eligibilityRuleSetId: null,
        updatedAt: new Date().toISOString(),
      }
    );
    return docToRole(updated);
  }

  const ruleName = input.eligibilityRuleName ?? `${role.title} Eligibility`;
  const description = input.eligibilityRuleDescription;
  const ruleTree = input.eligibilityRuleTree as EligibilityRuleSet["ruleTree"];
  const ruleSet = role.eligibilityRuleSetId
    ? await updateEligibilityRuleSet(actor, role.eligibilityRuleSetId, {
        name: ruleName,
        description,
        ruleTree,
      })
    : await createEligibilityRuleSet(actor, {
        roleId: role.$id,
        name: ruleName,
        description,
        ruleTree,
      });

  if (role.eligibilityRuleSetId === ruleSet.$id) {
    return role;
  }

  const updatedRole = await databases.updateDocument<Models.DefaultDocument>(
    DATABASE_ID,
    Collections.ROLES,
    role.$id,
    {
      eligibilityRuleSetId: ruleSet.$id,
      updatedAt: new Date().toISOString(),
    }
  );
  return docToRole(updatedRole);
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
