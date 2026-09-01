import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { AppError, toUserMessage } from "@/lib/errors";
import { executeImportPreview } from "@/lib/import-export/service";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const body = await request.json() as { previewId?: string };
    if (!body.previewId) {
      throw AppError.validationError("previewId is required.");
    }
    return NextResponse.json(await executeImportPreview(actor, body.previewId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
  }
  console.error("[api/admin/import-export/confirm]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
