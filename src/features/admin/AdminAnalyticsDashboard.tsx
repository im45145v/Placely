import Link from "next/link";
import type { AdminAnalyticsReport, AnalyticsBreakdown } from "@/lib/analytics/types";
import type { Company, Role } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

interface AdminAnalyticsDashboardProps {
  report: AdminAnalyticsReport;
  companies: Company[];
  roles: Role[];
}

export function AdminAnalyticsDashboard({ report, companies, roles }: AdminAnalyticsDashboardProps) {
  const exportParams = new URLSearchParams();
  appendIfPresent(exportParams, "companyId", report.filters.companyId);
  appendIfPresent(exportParams, "roleId", report.filters.roleId);
  appendIfPresent(exportParams, "branch", report.filters.branch);
  appendIfPresent(exportParams, "ugDegree", report.filters.ugDegree);
  appendIfPresent(exportParams, "graduationYear", report.filters.graduationYear ? String(report.filters.graduationYear) : undefined);
  appendIfPresent(exportParams, "customVariable", report.filters.customVariable);
  appendIfPresent(exportParams, "customVariableValue", report.filters.customVariableValue);
  appendIfPresent(exportParams, "dateFrom", report.filters.dateFrom);
  appendIfPresent(exportParams, "dateTo", report.filters.dateTo);

  const metrics = Object.values(report.metrics);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analytics filters</CardTitle>
          <CardDescription>
            Filters are applied server-side. Date range uses application submission date to scope the cohort.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/admin/dashboard" className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select name="companyId" defaultValue={report.filters.companyId ?? ""} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">All companies</option>
              {companies.map((company) => (
                <option key={company.$id} value={company.$id}>{company.name}</option>
              ))}
            </select>
            <select name="roleId" defaultValue={report.filters.roleId ?? ""} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">All roles</option>
              {roles.map((role) => (
                <option key={role.$id} value={role.$id}>{role.title}</option>
              ))}
            </select>
            <input name="branch" defaultValue={report.filters.branch ?? ""} placeholder="Branch" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <input name="ugDegree" defaultValue={report.filters.ugDegree ?? ""} placeholder="UG background" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <input name="graduationYear" defaultValue={report.filters.graduationYear ?? ""} placeholder="Graduation year" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <select name="customVariable" defaultValue={report.filters.customVariable ?? ""} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Custom variable breakdown</option>
              {report.customVariableOptions.map((variable) => (
                <option key={variable.$id} value={variable.name}>{variable.label}</option>
              ))}
            </select>
            <input
              name="customVariableValue"
              defaultValue={report.filters.customVariableValue ?? ""}
              placeholder="Custom variable value"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input type="date" name="dateFrom" defaultValue={report.filters.dateFrom ?? ""} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <input type="date" name="dateTo" defaultValue={report.filters.dateTo ?? ""} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <div className="flex gap-2 xl:col-span-1">
              <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Apply</button>
              <Link href="/admin/dashboard" className="rounded-md border border-input px-4 py-2 text-sm font-medium">Reset</Link>
              <Link href={`/api/admin/analytics/export?${exportParams.toString()}`} className="rounded-md border border-input px-4 py-2 text-sm font-medium">Export CSV</Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-3xl">
                {metric.label === "Placement rate" ? `${metric.value}%` : metric.value.toLocaleString("en-IN")}
              </CardTitle>
            </CardHeader>
            {metric.subtitle ? (
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
              </CardContent>
            ) : null}
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {report.breakdowns.map((breakdown) => (
          <BreakdownCard key={breakdown.key} breakdown={breakdown} />
        ))}
      </div>
    </div>
  );
}

function BreakdownCard({ breakdown }: { breakdown: AnalyticsBreakdown }) {
  const maxCount = Math.max(...breakdown.buckets.map((item) => item.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{breakdown.label}</CardTitle>
        <CardDescription>
          {breakdown.total.toLocaleString("en-IN")} records included. Top {breakdown.buckets.length} buckets shown for readability.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {breakdown.buckets.map((bucket) => (
          <div key={bucket.key} className="grid grid-cols-[minmax(0,160px)_1fr_auto] items-center gap-3">
            <div className="truncate text-sm text-foreground" title={bucket.label}>
              {formatBucketLabel(breakdown.key, bucket.label)}
            </div>
            <div className="h-3 rounded-full bg-accent">
              <div
                className="h-3 rounded-full bg-primary"
                style={{ width: `${Math.max((bucket.count / maxCount) * 100, 3)}%` }}
              />
            </div>
            <div className="whitespace-nowrap text-xs text-muted-foreground">
              {bucket.count.toLocaleString("en-IN")} ({bucket.percentage}%)
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function formatBucketLabel(_key: string, label: string): string {
  return label;
}

function appendIfPresent(params: URLSearchParams, key: string, value?: string): void {
  if (value) {
    params.set(key, value);
  }
}
