import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import {
  archiveRoleForAdmin,
  getRoleDetailForAdmin,
  updateRoleForAdmin,
} from "@/lib/companies/service";
import { AppError, toUserMessage } from "@/lib/errors";
import type { RuleNode } from "@/types";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ roleId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const { roleId } = await context.params;
    return NextResponse.json(await getRoleDetailForAdmin(actor, roleId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ roleId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const { roleId } = await context.params;
    const formData = await request.formData();
    const role = await updateRoleForAdmin(
      actor,
      roleId,
      {
        companyId: String(formData.get("companyId") ?? ""),
        title: String(formData.get("title") ?? ""),
        location: optionalString(formData.get("location")),
        workMode: optionalString(formData.get("workMode")) as "remote" | "onsite" | "hybrid" | undefined,
        employmentType: optionalString(formData.get("employmentType")) as "full_time" | "part_time" | "internship" | "contract" | undefined,
        ctc: optionalNumber(formData.get("ctc")),
        fixedCtc: optionalNumber(formData.get("fixedCtc")),
        variableCtc: optionalNumber(formData.get("variableCtc")),
        joiningDate: optionalString(formData.get("joiningDate")),
        numberOfOpenings: optionalInteger(formData.get("numberOfOpenings")),
        applicationDeadline: optionalString(formData.get("applicationDeadline")),
        description: optionalString(formData.get("description")),
        requiredSkills: splitLines(formData.get("requiredSkills")),
        requiredQualifications: splitLines(formData.get("requiredQualifications")),
        eligibilityRuleName: optionalString(formData.get("eligibilityRuleName")),
        eligibilityRuleDescription: optionalString(formData.get("eligibilityRuleDescription")),
        eligibilityRuleTree: optionalJson(formData.get("eligibilityRuleTree")) as RuleNode | null,
      },
      asFile(formData.get("jd"))
    );
    return NextResponse.json(role);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ roleId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const { roleId } = await context.params;
    return NextResponse.json(await archiveRoleForAdmin(actor, roleId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

function splitLines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  const normalized = optionalString(value);
  return normalized ? Number(normalized) : undefined;
}

function optionalInteger(value: FormDataEntryValue | null): number | undefined {
  const normalized = optionalString(value);
  return normalized ? Number.parseInt(normalized, 10) : undefined;
}

function asFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

function optionalJson(value: FormDataEntryValue | null): unknown {
  const normalized = optionalString(value);
  return normalized ? JSON.parse(normalized) : null;
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error) }, { status: error.statusCode });
  }
  console.error("[api/admin/roles/[roleId]]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
