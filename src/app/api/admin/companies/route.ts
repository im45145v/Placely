import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { createCompanyForAdmin, listCompaniesForAdmin } from "@/lib/companies/service";
import { AppError, toUserMessage } from "@/lib/errors";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const url = new URL(request.url);
    const result = await listCompaniesForAdmin(actor, {
      search: url.searchParams.get("search") ?? undefined,
      status: (url.searchParams.get("status") as "active" | "archived" | "all" | null) ?? undefined,
      page: Number(url.searchParams.get("page") ?? "1"),
    });
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const formData = await request.formData();
    const company = await createCompanyForAdmin(
      actor,
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
    return NextResponse.json(company, { status: 201 });
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
  console.error("[api/admin/companies]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
