import { NextResponse } from "next/server";
import { requireAuthenticatedAppUser } from "@/lib/auth/guards";
import { AppError, toUserMessage } from "@/lib/errors";
import {
  getResumeSummaryForActor,
  uploadResumeForActor,
} from "@/lib/resumes/service";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireAuthenticatedAppUser();
    const summary = await getResumeSummaryForActor(actor);
    return NextResponse.json(summary);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireAuthenticatedAppUser();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw AppError.validationError("Resume file is required.");
    }

    const summary = await uploadResumeForActor(actor, file);
    return NextResponse.json(summary, { status: 201 });
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

  console.error("[api/resumes]", error);
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    { status: 500 }
  );
}
