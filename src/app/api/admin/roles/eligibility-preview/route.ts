import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { previewRoleEligibilityForAdmin } from "@/lib/companies/service";
import { AppError, toUserMessage } from "@/lib/errors";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const body = (await request.json()) as {
      roleId?: string;
      currentRuleTree?: unknown;
      draftRuleTree?: unknown;
    };

    return NextResponse.json(
      await previewRoleEligibilityForAdmin(actor, {
        roleId: body.roleId,
        currentRuleTree: body.currentRuleTree as never,
        draftRuleTree: body.draftRuleTree as never,
      })
    );
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.code, message: toUserMessage(error) }, { status: error.statusCode });
    }
    console.error("[api/admin/roles/eligibility-preview]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
  }
}
