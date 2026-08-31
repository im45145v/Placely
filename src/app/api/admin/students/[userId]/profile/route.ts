import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { AppError, toUserMessage } from "@/lib/errors";
import {
  getStudentProfileForActor,
  updateStudentProfileForActor,
} from "@/lib/student-profile/service";
import { validateStudentProfileUpdatePayload } from "@/lib/student-profile/validation";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const { userId } = await context.params;
    const profile = await getStudentProfileForActor(actor, userId);
    return NextResponse.json(profile);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const { userId } = await context.params;
    const payload = validateStudentProfileUpdatePayload(await request.json());
    const profile = await updateStudentProfileForActor(actor, userId, payload);
    return NextResponse.json(profile);
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.code, message: toUserMessage(error), details: error.details },
      { status: error.statusCode }
    );
  }

  console.error("[api/admin/students/[userId]/profile]", error);
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    { status: 500 }
  );
}
