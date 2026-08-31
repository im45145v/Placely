import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { AppError, toUserMessage } from "@/lib/errors";
import {
  createVariableForAdmin,
  listVariablesForUniversity,
} from "@/lib/variables/service";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    return NextResponse.json(await listVariablesForUniversity(actor));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const body = (await request.json()) as Record<string, unknown>;
    const created = await createVariableForAdmin(actor, {
      name: String(body.name ?? ""),
      label: String(body.label ?? ""),
      description: typeof body.description === "string" ? body.description : undefined,
      type: body.type as never,
      options: Array.isArray(body.options) ? body.options.map((item) => String(item)) : undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : true,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error) }, { status: error.statusCode });
  }
  console.error("[api/admin/variables]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
