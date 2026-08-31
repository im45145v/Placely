import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { runBulkApplicationActionForAdmin } from "@/lib/applications/service";
import { AppError, toUserMessage } from "@/lib/errors";
import type { RuleNode } from "@/types";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const body = (await request.json()) as {
      action?: string;
      applicationIds?: string[];
      notes?: string;
      roundId?: string;
      filters?: {
        search?: string;
        status?: string;
        roleId?: string;
        companyId?: string;
        studentFilter?: RuleNode | null;
      };
    };
    const ids = Array.isArray(body.applicationIds) ? body.applicationIds.map(String).filter(Boolean) : [];
    if (ids.length === 0 && !body.filters) {
      throw AppError.validationError("At least one application must be selected.");
    }
    if (body.action === "shortlist" || body.action === "reject" || body.action === "move_to_round" || body.action === "auto_shortlist") {
      return NextResponse.json(await runBulkApplicationActionForAdmin(actor, {
          action: body.action,
          applicationIds: ids,
          notes: body.notes,
          roundId: body.roundId,
          filters: body.filters ? {
            ...body.filters,
            status: body.filters.status as never,
          } : undefined,
      }));
    }
    throw AppError.validationError("Unsupported bulk action.");
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
  }
  console.error("[api/admin/applications/bulk]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
