import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import {
  archiveCompanyForAdmin,
  getCompanyDetailForAdmin,
  updateCompanyForAdmin,
} from "@/lib/companies/service";
import { AppError, toUserMessage } from "@/lib/errors";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ companyId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const { companyId } = await context.params;
    return NextResponse.json(await getCompanyDetailForAdmin(actor, companyId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const { companyId } = await context.params;
    const formData = await request.formData();
    const company = await updateCompanyForAdmin(
      actor,
      companyId,
      {
        name: String(formData.get("name") ?? ""),
        website: optionalString(formData.get("website")),
        industry: optionalString(formData.get("industry")),
        description: optionalString(formData.get("description")),
        locations: splitLines(formData.get("locations")),
        companyType: optionalString(formData.get("companyType")),
        contactName: optionalString(formData.get("contactName")),
        contactEmail: optionalString(formData.get("contactEmail")),
        contactPhone: optionalString(formData.get("contactPhone")),
      },
      asFile(formData.get("logo"))
    );
    return NextResponse.json(company);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ companyId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const { companyId } = await context.params;
    return NextResponse.json(await archiveCompanyForAdmin(actor, companyId));
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

function asFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error) }, { status: error.statusCode });
  }
  console.error("[api/admin/companies/[companyId]]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
