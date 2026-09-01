import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { AppError, toUserMessage } from "@/lib/errors";
import { readStoredReport } from "@/lib/import-export/service";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> }
): Promise<Response> {
  try {
    await requireRoleAccess(ADMIN_ROLES);
    const { reportId } = await params;
    const content = await readStoredReport(reportId);
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/tab-separated-values; charset=utf-8",
        "Content-Disposition": `attachment; filename="import-errors-${reportId}.tsv"`,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
    }
    console.error("[api/admin/import-export/reports/[reportId]]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
  }
}
