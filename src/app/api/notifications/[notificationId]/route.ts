import { NextResponse } from "next/server";
import { requireStudentAccess } from "@/lib/auth/guards";
import { markNotificationRead } from "@/lib/notifications/service";
import { AppError, toUserMessage } from "@/lib/errors";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ notificationId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireStudentAccess();
    const { notificationId } = await context.params;
    return NextResponse.json(await markNotificationRead(actor, notificationId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
  }
  console.error("[api/notifications/[notificationId]]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
