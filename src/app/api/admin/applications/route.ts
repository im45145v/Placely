import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { createApplicationForAdmin, listApplicationsForAdmin } from "@/lib/applications/service";
import { AppError, toUserMessage } from "@/lib/errors";
import type { RuleNode } from "@/types";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const url = new URL(request.url);
    const result = await listApplicationsForAdmin(actor, {
      search: url.searchParams.get("search") ?? undefined,
      status: (url.searchParams.get("status") as never) ?? "all",
      roleId: url.searchParams.get("roleId") ?? undefined,
      companyId: url.searchParams.get("companyId") ?? undefined,
      studentFilter: parseRuleNode(url.searchParams.get("studentFilter")),
      page: Number(url.searchParams.get("page") ?? "1"),
    });
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

function parseRuleNode(value: string | null): RuleNode | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as RuleNode;
  } catch {
    throw AppError.validationError("Invalid student filter.");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const body = (await request.json()) as {
      roleId?: string;
      studentUserId?: string;
      overrideReason?: string;
    };
    const result = await createApplicationForAdmin(actor, {
      roleId: String(body.roleId ?? ""),
      studentUserId: String(body.studentUserId ?? ""),
      overrideReason: body.overrideReason,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
  }
  console.error("[api/admin/applications]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
