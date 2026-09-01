import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { AppError, toUserMessage } from "@/lib/errors";
import { createImportPreview, IMPORT_EXPORT_ENTITIES } from "@/lib/import-export/service";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const formData = await request.formData();
    const entity = String(formData.get("entity") ?? "");
    const file = formData.get("file");

    if (!IMPORT_EXPORT_ENTITIES.includes(entity as never)) {
      throw AppError.validationError("Unsupported import entity.");
    }
    if (!(file instanceof File)) {
      throw AppError.validationError("Import file is required.");
    }

    return NextResponse.json(await createImportPreview(actor, entity as never, file));
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
  }
  console.error("[api/admin/import-export/preview]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
