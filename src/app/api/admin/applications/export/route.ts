import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { exportApplicationsCsvForAdmin } from "@/lib/applications/service";
import { AppError, toUserMessage } from "@/lib/errors";
import type { RuleNode } from "@/types";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const url = new URL(request.url);
    const csv = await exportApplicationsCsvForAdmin(actor, {
      search: url.searchParams.get("search") ?? undefined,
      status: (url.searchParams.get("status") as never) ?? "all",
      roleId: url.searchParams.get("roleId") ?? undefined,
      companyId: url.searchParams.get("companyId") ?? undefined,
      studentFilter: parseRuleNode(url.searchParams.get("studentFilter")),
    });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="applications-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
    }
    console.error("[api/admin/applications/export]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
  }
}

function parseRuleNode(value: string | null): RuleNode | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as RuleNode;
  } catch {
    throw AppError.validationError("Invalid student filter.");
  }
}
