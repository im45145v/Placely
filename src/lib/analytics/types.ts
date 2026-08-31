import type { AppUser, ApplicationStatus } from "@/types";
import type { VariableDefinition } from "@/lib/variables/types";

export interface AnalyticsFilters {
  companyId?: string;
  roleId?: string;
  branch?: string;
  ugDegree?: string;
  graduationYear?: number;
  customVariable?: string;
  customVariableValue?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AnalyticsMetric {
  label: string;
  value: number;
  subtitle?: string;
}

export interface AnalyticsBreakdownBucket {
  key: string;
  label: string;
  count: number;
  percentage: number;
}

export interface AnalyticsBreakdown {
  key: string;
  label: string;
  type: "bar" | "histogram";
  buckets: AnalyticsBreakdownBucket[];
  total: number;
}

export interface AdminAnalyticsReport {
  generatedAt: string;
  filters: AnalyticsFilters;
  metrics: {
    totalStudents: AnalyticsMetric;
    activeStudents: AnalyticsMetric;
    companies: AnalyticsMetric;
    roles: AnalyticsMetric;
    applications: AnalyticsMetric;
    shortlisted: AnalyticsMetric;
    interviewed: AnalyticsMetric;
    selected: AnalyticsMetric;
    offers: AnalyticsMetric;
    placementRate: AnalyticsMetric;
  };
  breakdowns: AnalyticsBreakdown[];
  customVariableOptions: VariableDefinition[];
  cohortSummary: {
    studentCount: number;
    applicationCount: number;
    companyCount: number;
    roleCount: number;
  };
}

export interface AnalyticsExportRow {
  section: string;
  metric: string;
  value: string | number;
}

export interface StudentAnalyticsSnapshot {
  userId: string;
  profileId: string;
  isActive: boolean;
  createdAt: string;
  branch: string;
  ugDegree: string;
  graduationYear: string;
  cgpa: number | null;
  age: number | null;
  workExperienceMonths: number | null;
  previousWorkExperience: boolean;
  offerCtc: number | null;
  placementStatus: string;
  customFields: Record<string, unknown>;
}

export interface ApplicationAnalyticsSnapshot {
  applicationId: string;
  studentId: string;
  companyId: string;
  companyName: string;
  roleId: string;
  roleTitle: string;
  status: ApplicationStatus;
  appliedAt: string;
  lastStatusChangedAt: string;
}

export interface AnalyticsContext {
  actor: AppUser;
  variableDefinitions: VariableDefinition[];
}
