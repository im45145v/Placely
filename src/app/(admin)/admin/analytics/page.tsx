import type { Metadata } from "next";
import { PageHeader, PageWrapper } from "@/components/layout/PageWrapper";
import { AdminAnalyticsDashboard } from "@/features/admin/AdminAnalyticsDashboard";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { getAdminAnalyticsReport, listAdminAnalyticsFilterOptions } from "@/lib/analytics/service";

export const metadata: Metadata = {
  title: "Admin Analytics",
};

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export default async function AdminAnalyticsPage({
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
  const [analyticsReport, filterOptions] = await Promise.all([
    getAdminAnalyticsReport(actor, filters),
    listAdminAnalyticsFilterOptions(actor),
  ]);

  return (
    <PageWrapper>
      <PageHeader
        title="Analytics"
        description="Dedicated analytics workspace with server-side cohort filters, funnel metrics, breakdowns, and CSV export."
      />
      <AdminAnalyticsDashboard report={analyticsReport} companies={filterOptions.companies} roles={filterOptions.roles} />
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
