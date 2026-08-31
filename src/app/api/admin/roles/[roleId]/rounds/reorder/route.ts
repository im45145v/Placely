import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { reorderPlacementRoundsForAdmin } from "@/lib/applications/service";
import { AppError, toUserMessage } from "@/lib/errors";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ roleId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const { roleId } = await context.params;
    const body = (await request.json()) as { roundIds?: string[] };
    if (!Array.isArray(body.roundIds) || body.roundIds.length === 0) {
      throw AppError.validationError("roundIds is required.");
    }
    return NextResponse.json(await reorderPlacementRoundsForAdmin(actor, roleId, body.roundIds.map(String)));
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
  }
  console.error("[api/admin/roles/[roleId]/rounds/reorder]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
