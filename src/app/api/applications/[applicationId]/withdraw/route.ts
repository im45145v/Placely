import { NextResponse } from "next/server";
import { requireStudentAccess } from "@/lib/auth/guards";
import { withdrawApplicationForStudent } from "@/lib/applications/service";
import { AppError, toUserMessage } from "@/lib/errors";

export async function POST(
  _request: Request,
  context: { params: Promise<{ applicationId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireStudentAccess();
    const { applicationId } = await context.params;
    return NextResponse.json(await withdrawApplicationForStudent(actor, applicationId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
  }
  console.error("[api/applications/[applicationId]/withdraw]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
