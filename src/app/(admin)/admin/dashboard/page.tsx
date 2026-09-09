import type { Metadata } from "next";
import { PageWrapper, PageHeader } from "@/components/layout/PageWrapper";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { getAdminAnalyticsReport, listAdminAnalyticsFilterOptions } from "@/lib/analytics/service";
import { listSubmittedResumesForAdmin } from "@/lib/resumes/service";
import { AdminAnalyticsDashboard } from "@/features/admin/AdminAnalyticsDashboard";
import { AdminResumeReview } from "@/features/admin/AdminResumeReview";
import { AdminOverview } from "@/features/admin/AdminOverview";
import { getAdminDashboardSummary } from "@/lib/admin/service";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireRoleAccess(ADMIN_ROLES);
  const params = searchParams ? await searchParams : {};
  const filters = {
    companyId: getSingleParam(params.companyId),
    roleId: getSingleParam(params.roleId),
    branch: getSingleParam(params.branch),
    ugDegree: getSingleParam(params.ugDegree),
    graduationYear: parseNumber(getSingleParam(params.graduationYear)),
    customVariable: getSingleParam(params.customVariable),
    customVariableValue: getSingleParam(params.customVariableValue),
    dateFrom: getSingleParam(params.dateFrom),
    dateTo: getSingleParam(params.dateTo),
  };
  const [pendingResumes, analyticsReport, filterOptions, summary] = await Promise.all([
    listSubmittedResumesForAdmin(actor),
    getAdminAnalyticsReport(actor, filters),
    listAdminAnalyticsFilterOptions(actor),
    getAdminDashboardSummary(actor),
  ]);

  return (
    <PageWrapper>
      <PageHeader
        title="Admin Dashboard"
        description="Placement analytics, cohort breakdowns, and resume verification workflow."
      />
      <AdminOverview summary={summary} />
      <div className="mt-6">
      <AdminAnalyticsDashboard report={analyticsReport} companies={filterOptions.companies} roles={filterOptions.roles} />
      </div>
      <div className="mt-6">
      <AdminResumeReview initialRecords={pendingResumes} />
      </div>
    </PageWrapper>
  );
}

function getSingleParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
