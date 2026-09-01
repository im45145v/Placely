import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { AppError, toUserMessage } from "@/lib/errors";
import { exportEntityRows, IMPORT_EXPORT_ENTITIES, IMPORT_EXPORT_FORMATS } from "@/lib/import-export/service";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const url = new URL(request.url);
    const entity = url.searchParams.get("entity") ?? "";
    const format = url.searchParams.get("format") ?? "csv";

    if (!IMPORT_EXPORT_ENTITIES.includes(entity as never)) {
      throw AppError.validationError("Unsupported export entity.");
    }
    if (!IMPORT_EXPORT_FORMATS.includes(format as never)) {
      throw AppError.validationError("Unsupported export format.");
    }

    const result = await exportEntityRows(actor, entity as never, format as never);
    return new Response(result.content, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
    }
    console.error("[api/admin/import-export/export]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
  }
}
