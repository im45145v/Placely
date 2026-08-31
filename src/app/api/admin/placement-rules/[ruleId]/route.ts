import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import {
  deletePlacementRuleForAdmin,
  updatePlacementRuleForAdmin,
} from "@/lib/placement-rules/service";
import { AppError, toUserMessage } from "@/lib/errors";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ ruleId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const { ruleId } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      ruleType?: string;
      config?: Record<string, unknown>;
      isActive?: boolean;
    };
    const updated = await updatePlacementRuleForAdmin(actor, ruleId, {
      name: String(body.name ?? ""),
      description: body.description,
      ruleType: body.ruleType as never,
      config: body.config ?? {},
      isActive: body.isActive,
    });
    return NextResponse.json(updated);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ ruleId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const { ruleId } = await context.params;
    await deletePlacementRuleForAdmin(actor, ruleId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.code, message: toUserMessage(error), details: error.details },
      { status: error.statusCode }
    );
  }
  console.error("[api/admin/placement-rules/[ruleId]]", error);
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    { status: 500 }
  );
}
