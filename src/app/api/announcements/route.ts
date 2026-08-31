import { NextResponse } from "next/server";
import { requireAuthenticatedAppUser } from "@/lib/auth/guards";
import { listImportantAnnouncements } from "@/lib/announcements/service";
import { AppError, toUserMessage } from "@/lib/errors";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireAuthenticatedAppUser();
    return NextResponse.json(await listImportantAnnouncements(actor));
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
  }
  console.error("[api/announcements]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
