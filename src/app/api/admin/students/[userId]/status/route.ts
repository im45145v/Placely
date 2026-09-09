import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { AppError, toUserMessage } from "@/lib/errors";
import { updateStudentActivationForAdmin } from "@/lib/student-profile/service";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const { userId } = await context.params;
    const body = await request.json();
    const isActive = body && typeof body.isActive === "boolean" ? body.isActive : undefined;
    if (typeof isActive !== "boolean") {
      throw AppError.validationError("The isActive flag is required.");
    }

    const result = await updateStudentActivationForAdmin(actor, userId, isActive);
    return NextResponse.json({ ...result, message: isActive ? "Student access enabled." : "Student access disabled." });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.code, message: toUserMessage(error), details: error.details },
        { status: error.statusCode }
      );
    }

    console.error("[api/admin/students/[userId]/status]", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
