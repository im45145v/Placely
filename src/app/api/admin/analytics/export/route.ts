import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { exportAdminAnalyticsCsv } from "@/lib/analytics/service";
import { AppError, toUserMessage } from "@/lib/errors";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const url = new URL(request.url);
    const csv = await exportAdminAnalyticsCsv(actor, {
      companyId: url.searchParams.get("companyId") ?? undefined,
      roleId: url.searchParams.get("roleId") ?? undefined,
      branch: url.searchParams.get("branch") ?? undefined,
      ugDegree: url.searchParams.get("ugDegree") ?? undefined,
      graduationYear: parseNumber(url.searchParams.get("graduationYear")),
      customVariable: url.searchParams.get("customVariable") ?? undefined,
      customVariableValue: url.searchParams.get("customVariableValue") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
    });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="analytics-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
    }
    console.error("[api/admin/analytics/export]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
  }
}

function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
