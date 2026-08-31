import { NextResponse } from "next/server";
import { requireAuthenticatedAppUser } from "@/lib/auth/guards";
import { AppError, toUserMessage } from "@/lib/errors";
import {
  getStudentProfileForActor,
  updateStudentProfileForActor,
} from "@/lib/student-profile/service";
import { validateStudentProfileUpdatePayload } from "@/lib/student-profile/validation";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireAuthenticatedAppUser();
    const profile = await getStudentProfileForActor(actor);
    return NextResponse.json(profile);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireAuthenticatedAppUser();
    const payload = validateStudentProfileUpdatePayload(await request.json());
    const profile = await updateStudentProfileForActor(actor, actor.$id, payload);
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

  console.error("[api/profile]", error);
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    { status: 500 }
  );
}
