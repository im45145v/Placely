import { NextResponse } from "next/server";
import { requireAuthenticatedAppUser } from "@/lib/auth/guards";
import { AppError, toUserMessage } from "@/lib/errors";
import { deleteResumeForActor } from "@/lib/resumes/service";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ resumeId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireAuthenticatedAppUser();
    const { resumeId } = await context.params;
    const summary = await deleteResumeForActor(actor, resumeId);
    return NextResponse.json(summary);
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

  console.error("[api/resumes/[resumeId]]", error);
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    { status: 500 }
  );
}
