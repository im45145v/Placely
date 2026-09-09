import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AdminDashboardSummary } from "@/lib/admin/service";

/**
 * High-signal metrics only. Every other admin section is already reachable
 * from the grouped sidebar, so we don't duplicate all 17 sections here.
 */
export function AdminOverview({ summary }: { summary: AdminDashboardSummary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {summary.metrics.map((metric) => (
        <Link
          key={metric.label}
          href={metric.href}
          className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card className="h-full transition-colors hover:border-primary/40">
            <CardHeader className="pb-2">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-3xl">{metric.value}</CardTitle>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}

