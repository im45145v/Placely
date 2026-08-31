import { NextResponse } from "next/server";
import { requireAuthenticatedAppUser } from "@/lib/auth/guards";
import { AppError, toUserMessage } from "@/lib/errors";
import { getResumeFileForActor } from "@/lib/resumes/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ resumeId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireAuthenticatedAppUser();
    const { resumeId } = await context.params;
    const { resume, file } = await getResumeFileForActor(actor, resumeId);
    return new NextResponse(file, {
      headers: {
        "Content-Type": resume.mimeType,
        "Content-Disposition": `inline; filename="${resume.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
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

  console.error("[api/resumes/[resumeId]/preview]", error);
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    { status: 500 }
  );
}
