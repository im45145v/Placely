import { NextResponse } from "next/server";
import { requireStudentAccess } from "@/lib/auth/guards";
import { createApplicationForStudent, listApplicationsForStudent } from "@/lib/applications/service";
import { AppError, toUserMessage } from "@/lib/errors";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireStudentAccess();
    const url = new URL(request.url);
    const result = await listApplicationsForStudent(actor, {
      search: url.searchParams.get("search") ?? undefined,
      status: (url.searchParams.get("status") as never) ?? "all",
      page: Number(url.searchParams.get("page") ?? "1"),
    });
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireStudentAccess();
    const body = (await request.json()) as { roleId?: string };
    const application = await createApplicationForStudent(actor, String(body.roleId ?? ""));
    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
  }
  console.error("[api/applications]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
