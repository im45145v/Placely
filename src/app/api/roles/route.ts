import { NextResponse } from "next/server";
import { requireStudentAccess } from "@/lib/auth/guards";
import { listRolesForStudents } from "@/lib/companies/service";
import { AppError, toUserMessage } from "@/lib/errors";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireStudentAccess();
    const url = new URL(request.url);
    const result = await listRolesForStudents(actor, {
      search: url.searchParams.get("search") ?? undefined,
      status: "published",
      companyId: url.searchParams.get("companyId") ?? undefined,
      page: Number(url.searchParams.get("page") ?? "1"),
    });
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error) }, { status: error.statusCode });
  }
  console.error("[api/roles]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
