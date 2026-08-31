import { NextResponse } from "next/server";
import { requireStudentAccess } from "@/lib/auth/guards";
import { listCompaniesForStudents } from "@/lib/companies/service";
import { AppError, toUserMessage } from "@/lib/errors";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireStudentAccess();
    const url = new URL(request.url);
    const result = await listCompaniesForStudents(actor, {
      search: url.searchParams.get("search") ?? undefined,
      status: "active",
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
  console.error("[api/companies]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
