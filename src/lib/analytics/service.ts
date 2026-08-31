import { Models, Query } from "node-appwrite";
import { Collections, DATABASE_ID } from "@/lib/appwrite/constants";
import { createServerServices } from "@/lib/appwrite/server";
import { USER_ROLES } from "@/lib/auth/roles";
import { listVariablesForUniversity } from "@/lib/variables/service";
import type { VariableDefinition } from "@/lib/variables/types";
import type { AppUser, Application, Company, Role, StudentProfile } from "@/types";
import type {
  AdminAnalyticsReport,
  AnalyticsBreakdown,
  AnalyticsBreakdownBucket,
  AnalyticsExportRow,
  AnalyticsFilters,
  ApplicationAnalyticsSnapshot,
  StudentAnalyticsSnapshot,
} from "./types";

const PAGE_SIZE = 100;
const COHORT_SHORTLIST_STATUSES = new Set(["SHORTLISTED", "IN_ROUND", "SELECTED", "OFFERED", "ACCEPTED", "DECLINED"]);
const COHORT_INTERVIEWED_STATUSES = new Set(["IN_ROUND", "SELECTED", "OFFERED", "ACCEPTED", "DECLINED"]);
const COHORT_SELECTED_STATUSES = new Set(["SELECTED", "OFFERED", "ACCEPTED", "DECLINED"]);
const COHORT_OFFER_STATUSES = new Set(["OFFERED", "ACCEPTED", "DECLINED"]);
const MAX_BREAKDOWN_BUCKETS = 12;

export async function getAdminAnalyticsReport(actor: AppUser, filters: AnalyticsFilters): Promise<AdminAnalyticsReport> {
  assertAdmin(actor);
  const [users, profiles, companies, roles, applications, variableDefinitions] = await Promise.all([
    listAllDocuments(Collections.USERS, actor),
    listAllDocuments(Collections.STUDENT_PROFILES, actor),
    listAllDocuments(Collections.COMPANIES, actor),
    listAllDocuments(Collections.ROLES, actor),
    listAllDocuments(Collections.APPLICATIONS, actor),
    listVariablesForUniversity(actor),
  ]);

  const studentByProfileId = new Map<string, StudentAnalyticsSnapshot>();
  const userById = new Map(users.map((doc) => {
    const user = docToAppUser(doc);
    return [user.$id, user];
  }));
  for (const profileDoc of profiles) {
    const profile = docToStudentProfile(profileDoc);
    const user = userById.get(profile.userId);
    if (!user) continue;
    const snapshot = toStudentSnapshot(user, profile);
    if (!passesStudentFilters(snapshot, filters)) continue;
    studentByProfileId.set(snapshot.profileId, snapshot);
  }

  const companyById = new Map(companies.map((doc) => {
    const company = docToCompany(doc);
    return [company.$id, company];
  }));
  const roleById = new Map(roles.map((doc) => {
    const role = docToRole(doc);
    return [role.$id, role];
  }));

  const scopedApplications = applications
    .map((doc) => docToApplication(doc))
    .filter((application) => studentByProfileId.has(application.studentId))
    .filter((application) => passesApplicationFilters(application, filters))
    .map((application) => {
      const company = companyById.get(application.companyId);
      const role = roleById.get(application.roleId);
      return {
        applicationId: application.$id,
        studentId: application.studentId,
        companyId: application.companyId,
        companyName: company?.name ?? "Unknown company",
        roleId: application.roleId,
        roleTitle: role?.title ?? "Unknown role",
        status: application.status,
        appliedAt: application.appliedAt,
        lastStatusChangedAt: application.lastStatusChangedAt,
      } satisfies ApplicationAnalyticsSnapshot;
    })
    .filter((item) => passesJoinFilters(item, filters));

  const cohortStudentIds = scopedApplications.length > 0 || hasApplicationScopedFilters(filters)
    ? new Set(scopedApplications.map((item) => item.studentId))
    : new Set(studentByProfileId.keys());
  const cohortStudents = Array.from(cohortStudentIds, (profileId) => studentByProfileId.get(profileId)).filter(Boolean) as StudentAnalyticsSnapshot[];

  const companyCount = scopedApplications.length > 0 || hasApplicationScopedFilters(filters)
    ? new Set(scopedApplications.map((item) => item.companyId)).size
    : companies.length;
  const roleCount = scopedApplications.length > 0 || hasApplicationScopedFilters(filters)
    ? new Set(scopedApplications.map((item) => item.roleId)).size
    : roles.length;

  const selectedStudentCount = new Set(
    scopedApplications
      .filter((item) => COHORT_SELECTED_STATUSES.has(item.status))
      .map((item) => item.studentId)
  ).size;

  return {
    generatedAt: new Date().toISOString(),
    filters,
    metrics: {
      totalStudents: metric("Total students", cohortStudents.length),
      activeStudents: metric("Active students", cohortStudents.filter((item) => item.isActive).length),
      companies: metric("Companies", companyCount),
      roles: metric("Roles", roleCount),
      applications: metric("Applications", scopedApplications.length),
      shortlisted: metric("Shortlisted", countByStatuses(scopedApplications, COHORT_SHORTLIST_STATUSES)),
      interviewed: metric("Interviewed", countByStatuses(scopedApplications, COHORT_INTERVIEWED_STATUSES)),
      selected: metric("Selected", countByStatuses(scopedApplications, COHORT_SELECTED_STATUSES)),
      offers: metric("Offers", countByStatuses(scopedApplications, COHORT_OFFER_STATUSES)),
      placementRate: {
        label: "Placement rate",
        value: cohortStudents.length > 0 ? Math.round((selectedStudentCount / cohortStudents.length) * 1000) / 10 : 0,
        subtitle: `${selectedStudentCount} selected students`,
      },
    },
    breakdowns: buildBreakdowns(cohortStudents, scopedApplications, variableDefinitions, filters.customVariable),
    customVariableOptions: variableDefinitions.filter((item) => !item.isBuiltIn),
    cohortSummary: {
      studentCount: cohortStudents.length,
      applicationCount: scopedApplications.length,
      companyCount,
      roleCount,
    },
  };
}

export async function exportAdminAnalyticsCsv(actor: AppUser, filters: AnalyticsFilters): Promise<string> {
  const report = await getAdminAnalyticsReport(actor, filters);
  const rows: AnalyticsExportRow[] = [];

  rows.push({ section: "summary", metric: "generated_at", value: report.generatedAt });
  rows.push({ section: "summary", metric: "date_from", value: filters.dateFrom ?? "" });
  rows.push({ section: "summary", metric: "date_to", value: filters.dateTo ?? "" });

  for (const [key, metricValue] of Object.entries(report.metrics)) {
    rows.push({ section: "metrics", metric: key, value: metricValue.subtitle ? `${metricValue.value} (${metricValue.subtitle})` : metricValue.value });
  }

  for (const breakdown of report.breakdowns) {
    for (const bucket of breakdown.buckets) {
      rows.push({
        section: breakdown.key,
        metric: bucket.label,
        value: `${bucket.count} (${bucket.percentage}%)`,
      });
    }
  }

  const header = ["section", "metric", "value"];
  const csvRows = rows.map((row) => [row.section, row.metric, String(row.value)]);
  return [header, ...csvRows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export async function listAdminAnalyticsFilterOptions(actor: AppUser): Promise<{
  companies: Company[];
  roles: Role[];
}> {
  assertAdmin(actor);
  const [companies, roles] = await Promise.all([
    listAllDocuments(Collections.COMPANIES, actor),
    listAllDocuments(Collections.ROLES, actor),
  ]);

  return {
    companies: companies.map(docToCompany).sort((left, right) => left.name.localeCompare(right.name)),
    roles: roles.map(docToRole).sort((left, right) => left.title.localeCompare(right.title)),
  };
}

async function listAllDocuments(collectionId: string, actor: AppUser): Promise<Models.DefaultDocument[]> {
  const { databases } = createServerServices();
  const documents: Models.DefaultDocument[] = [];
  let offset = 0;

  while (true) {
    const queries = [
      ...(actor.role === USER_ROLES.SUPER_ADMIN ? [] : [Query.equal("universityId", actor.universityId)]),
      Query.limit(PAGE_SIZE),
      Query.offset(offset),
    ];

    const result = await databases.listDocuments<Models.DefaultDocument>(DATABASE_ID, collectionId, queries);
    documents.push(...result.documents);

    if (result.documents.length < PAGE_SIZE) {
      break;
    }

    offset += result.documents.length;
  }

  return documents;
}

function buildBreakdowns(
  students: StudentAnalyticsSnapshot[],
  applications: ApplicationAnalyticsSnapshot[],
  variableDefinitions: VariableDefinition[],
  customVariableName?: string
): AnalyticsBreakdown[] {
  const selectedBreakdowns: AnalyticsBreakdown[] = [
    categoricalBreakdown("company", "By company", applications.map((item) => item.companyName)),
    categoricalBreakdown("role", "By role", applications.map((item) => item.roleTitle)),
    categoricalBreakdown("branch", "By branch", students.map((item) => item.branch)),
    categoricalBreakdown("ug_background", "By UG background", students.map((item) => item.ugDegree)),
    categoricalBreakdown("graduation_year", "By graduation year", students.map((item) => item.graduationYear)),
    numericRangeBreakdown("cgpa", "By CGPA", students.map((item) => item.cgpa), [
      { label: "< 6.0", min: Number.NEGATIVE_INFINITY, max: 6 },
      { label: "6.0-6.99", min: 6, max: 7 },
      { label: "7.0-7.99", min: 7, max: 8 },
      { label: "8.0-8.99", min: 8, max: 9 },
      { label: "9.0+", min: 9, max: Number.POSITIVE_INFINITY },
    ]),
    numericRangeBreakdown("age", "By age", students.map((item) => item.age), [
      { label: "< 20", min: Number.NEGATIVE_INFINITY, max: 20 },
      { label: "20-21", min: 20, max: 22 },
      { label: "22-23", min: 22, max: 24 },
      { label: "24-25", min: 24, max: 26 },
      { label: "26+", min: 26, max: Number.POSITIVE_INFINITY },
    ]),
    numericRangeBreakdown("work_experience", "By work experience", students.map((item) => item.workExperienceMonths), [
      { label: "0 months", min: 0, max: 1 },
      { label: "1-6 months", min: 1, max: 7 },
      { label: "7-12 months", min: 7, max: 13 },
      { label: "13-24 months", min: 13, max: 25 },
      { label: "24+ months", min: 25, max: Number.POSITIVE_INFINITY },
    ]),
    categoricalBreakdown("previous_work_experience", "By previous work experience", students.map((item) => item.previousWorkExperience ? "Yes" : "No")),
    numericRangeBreakdown("offer_ctc", "By offer CTC", students.map((item) => item.offerCtc), [
      { label: "< 5 LPA", min: Number.NEGATIVE_INFINITY, max: 500000 },
      { label: "5-10 LPA", min: 500000, max: 1000000 },
      { label: "10-20 LPA", min: 1000000, max: 2000000 },
      { label: "20-30 LPA", min: 2000000, max: 3000000 },
      { label: "30+ LPA", min: 3000000, max: Number.POSITIVE_INFINITY },
    ]),
  ];

  if (customVariableName) {
    const definition = variableDefinitions.find((item) => item.name === customVariableName);
    if (definition) {
      selectedBreakdowns.push(
        categoricalBreakdown(
          "custom_variable",
          `By ${definition.label}`,
          students.map((item) => formatUnknown(item.customFields[customVariableName]))
        )
      );
    }
  }

  return selectedBreakdowns.filter((item) => item.buckets.length > 0);
}

function categoricalBreakdown(key: string, label: string, values: string[]): AnalyticsBreakdown {
  const counts = new Map<string, number>();
  let total = 0;
  for (const rawValue of values) {
    const normalized = cleanCategory(rawValue);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    total += 1;
  }

  const buckets = Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, MAX_BREAKDOWN_BUCKETS)
    .map(([bucketLabel, count]) => toBucket(bucketLabel, bucketLabel, count, total));

  return { key, label, type: "bar", buckets, total };
}

function numericRangeBreakdown(
  key: string,
  label: string,
  values: Array<number | null>,
  ranges: Array<{ label: string; min: number; max: number }>
): AnalyticsBreakdown {
  const counts = new Map<string, number>(ranges.map((range) => [range.label, 0]));
  let total = 0;

  for (const value of values) {
    if (value === null || Number.isNaN(value)) continue;
    const range = ranges.find((item) => value >= item.min && value < item.max);
    if (!range) continue;
    counts.set(range.label, (counts.get(range.label) ?? 0) + 1);
    total += 1;
  }

  const buckets = ranges
    .map((range) => toBucket(range.label, range.label, counts.get(range.label) ?? 0, total))
    .filter((bucket) => bucket.count > 0);

  return { key, label, type: "histogram", buckets, total };
}

function toBucket(key: string, label: string, count: number, total: number): AnalyticsBreakdownBucket {
  return {
    key,
    label,
    count,
    percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
  };
}

function toStudentSnapshot(user: AppUser, profile: StudentProfile): StudentAnalyticsSnapshot {
  return {
    userId: user.$id,
    profileId: profile.$id,
    isActive: user.isActive,
    createdAt: profile.createdAt,
    branch: cleanCategory(profile.academic.ugBranch),
    ugDegree: cleanCategory(profile.academic.ugDegree),
    graduationYear: profile.academic.graduationYear ? String(profile.academic.graduationYear) : "Unknown",
    cgpa: typeof profile.academic.ugCgpa === "number" ? profile.academic.ugCgpa : null,
    age: getAge(profile.personalInfo.dateOfBirth),
    workExperienceMonths: typeof profile.professional.totalWorkExperienceMonths === "number"
      ? profile.professional.totalWorkExperienceMonths
      : null,
    previousWorkExperience: profile.professional.previousCompanies.length > 0,
    offerCtc: typeof profile.placement.currentOfferCtc === "number" ? profile.placement.currentOfferCtc : null,
    placementStatus: profile.placement.status,
    customFields: profile.customFields ?? {},
  };
}

function passesStudentFilters(student: StudentAnalyticsSnapshot, filters: AnalyticsFilters): boolean {
  if (filters.branch && student.branch !== filters.branch) return false;
  if (filters.ugDegree && student.ugDegree !== filters.ugDegree) return false;
  if (filters.graduationYear && student.graduationYear !== String(filters.graduationYear)) return false;
  if (filters.customVariable) {
    const value = formatUnknown(student.customFields[filters.customVariable]);
    if (filters.customVariableValue && value !== filters.customVariableValue) return false;
  }
  return true;
}

function passesApplicationFilters(application: Application, filters: AnalyticsFilters): boolean {
  if (filters.dateFrom && application.appliedAt < filters.dateFrom) return false;
  if (filters.dateTo && application.appliedAt > `${filters.dateTo}T23:59:59.999Z`) return false;
  return true;
}

function passesJoinFilters(application: ApplicationAnalyticsSnapshot, filters: AnalyticsFilters): boolean {
  if (filters.companyId && application.companyId !== filters.companyId) return false;
  if (filters.roleId && application.roleId !== filters.roleId) return false;
  return true;
}

function hasApplicationScopedFilters(filters: AnalyticsFilters): boolean {
  return Boolean(filters.companyId || filters.roleId || filters.dateFrom || filters.dateTo);
}

function countByStatuses(applications: ApplicationAnalyticsSnapshot[], statuses: Set<string>): number {
  return applications.filter((item) => statuses.has(item.status)).length;
}

function metric(label: string, value: number) {
  return { label, value };
}

function cleanCategory(value: unknown): string {
  if (typeof value !== "string") return "Unknown";
  const trimmed = value.trim();
  return trimmed || "Unknown";
}

function formatUnknown(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "Unknown";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    return String(value);
  }
  return cleanCategory(value);
}

function getAge(dateOfBirth?: string): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

function assertAdmin(actor: AppUser): void {
  if (actor.role !== USER_ROLES.PLACEMENT_ADMIN && actor.role !== USER_ROLES.SUPER_ADMIN) {
    throw new Error("Admin access is required.");
  }
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

function docToAppUser(doc: Models.DefaultDocument): AppUser {
  return {
    $id: doc.$id,
    name: String(doc.name),
    email: String(doc.email),
    universityId: String(doc.universityId),
    role: doc.role as AppUser["role"],
    isActive: Boolean(doc.isActive),
    onboardingCompletedAt: (doc.onboardingCompletedAt as string | undefined) ?? undefined,
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

function docToApplication(doc: Models.DefaultDocument): Application {
  return {
    $id: doc.$id,
    studentId: String(doc.studentId),
    roleId: String(doc.roleId),
    companyId: String(doc.companyId),
    universityId: String(doc.universityId),
    status: doc.status as Application["status"],
    currentRoundId: (doc.currentRoundId as string | undefined) ?? undefined,
    appliedAt: String(doc.appliedAt ?? doc.createdAt ?? doc.$createdAt),
    withdrawnAt: (doc.withdrawnAt as string | undefined) ?? undefined,
    lastStatusChangedAt: String(doc.lastStatusChangedAt ?? doc.updatedAt ?? doc.$updatedAt),
    notes: (doc.notes as string | undefined) ?? undefined,
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

function docToCompany(doc: Models.DefaultDocument): Company {
  return {
    $id: doc.$id,
    universityId: String(doc.universityId),
    name: String(doc.name),
    logo: (doc.logo as string | undefined) ?? undefined,
    website: (doc.website as string | undefined) ?? undefined,
    industry: (doc.industry as string | undefined) ?? undefined,
    description: (doc.description as string | undefined) ?? undefined,
    locations: Array.isArray(doc.locations) ? doc.locations.map(String) : [],
    companyType: (doc.companyType as string | undefined) ?? undefined,
    contactInfo: (doc.contactInfo as Company["contactInfo"]) ?? undefined,
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
    jdText: (doc.jdText as string | undefined) ?? undefined,
    jdAttachmentId: (doc.jdAttachmentId as string | undefined) ?? undefined,
    location: (doc.location as string | undefined) ?? undefined,
    workMode: (doc.workMode as Role["workMode"] | undefined) ?? undefined,
    employmentType: (doc.employmentType as Role["employmentType"] | undefined) ?? undefined,
    ctc: typeof doc.ctc === "number" ? doc.ctc : undefined,
    fixedCtc: typeof doc.fixedCtc === "number" ? doc.fixedCtc : undefined,
    variableCtc: typeof doc.variableCtc === "number" ? doc.variableCtc : undefined,
    joiningDate: (doc.joiningDate as string | undefined) ?? undefined,
    experienceRequirementMonths: typeof doc.experienceRequirementMonths === "number" ? doc.experienceRequirementMonths : undefined,
    numberOfOpenings: typeof doc.numberOfOpenings === "number" ? doc.numberOfOpenings : undefined,
    applicationDeadline: (doc.applicationDeadline as string | undefined) ?? undefined,
    selectionProcessDescription: (doc.selectionProcessDescription as string | undefined) ?? undefined,
    eligibilityRuleSetId: (doc.eligibilityRuleSetId as string | undefined) ?? undefined,
    requiredSkills: Array.isArray(doc.requiredSkills) ? doc.requiredSkills.map(String) : [],
    requiredQualifications: Array.isArray(doc.requiredQualifications) ? doc.requiredQualifications.map(String) : [],
    status: doc.status as Role["status"],
    createdAt: (doc.createdAt as string) ?? doc.$createdAt,
    updatedAt: (doc.updatedAt as string) ?? doc.$updatedAt,
  };
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}
