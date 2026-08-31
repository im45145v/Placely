import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { moveApplicationToRoundForAdmin } from "@/lib/applications/service";
import { AppError, toUserMessage } from "@/lib/errors";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const { applicationId } = await context.params;
    const body = (await request.json()) as { roundId?: string; notes?: string };
    if (!body.roundId) {
      throw AppError.validationError("roundId is required.");
    }
    return NextResponse.json(await moveApplicationToRoundForAdmin(actor, applicationId, body.roundId, body.notes));
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
    }
    console.error("[api/admin/applications/[applicationId]/move-to-round]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
  }
}
