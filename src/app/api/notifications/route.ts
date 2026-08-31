import { NextResponse } from "next/server";
import { requireStudentAccess } from "@/lib/auth/guards";
import { listNotificationsForStudent, markAllNotificationsRead } from "@/lib/notifications/service";
import { AppError, toUserMessage } from "@/lib/errors";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireStudentAccess();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    return NextResponse.json(await listNotificationsForStudent(actor, Number.isFinite(page) ? page : 1));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(): Promise<NextResponse> {
  try {
    const actor = await requireStudentAccess();
    return NextResponse.json(await markAllNotificationsRead(actor));
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
  }
  console.error("[api/notifications]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
