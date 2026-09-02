import { NextResponse } from "next/server";
import { requireStudentAccess } from "@/lib/auth/guards";
import { listRoleExplorerForStudents } from "@/lib/companies/service";
import { AppError, toUserMessage } from "@/lib/errors";
import type { EmploymentType, RoleExplorerQuery, WorkMode } from "@/types";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireStudentAccess();
    const url = new URL(request.url);
    const result = await listRoleExplorerForStudents(actor, parseExplorerQuery(url));
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

function parseExplorerQuery(url: URL): RoleExplorerQuery {
  const workMode = parseWorkMode(url.searchParams.get("workMode"));
  const employmentType = parseEmploymentType(url.searchParams.get("employmentType"));
  const sortBy = parseSortBy(url.searchParams.get("sortBy"));
  const sortDirection = parseSortDirection(url.searchParams.get("sortDirection"));

  return {
    search: cleanParam(url.searchParams.get("search")),
    status: "published",
    companyId: cleanParam(url.searchParams.get("companyId")),
    workMode,
    employmentType,
    sortBy,
    sortDirection,
    page: Number(url.searchParams.get("page") ?? "1"),
  };
}

function parseWorkMode(value: string | null): WorkMode | undefined {
  if (value === "remote" || value === "onsite" || value === "hybrid") {
    return value;
  }
  return undefined;
}

function parseEmploymentType(value: string | null): EmploymentType | undefined {
  if (
    value === "full_time" ||
    value === "part_time" ||
    value === "internship" ||
    value === "contract"
  ) {
    return value;
  }
  return undefined;
}

function parseSortBy(value: string | null): RoleExplorerQuery["sortBy"] {
  if (value === "deadline" || value === "recent" || value === "ctc") {
    return value;
  }
  return "deadline";
}

function parseSortDirection(value: string | null): RoleExplorerQuery["sortDirection"] {
  if (value === "asc" || value === "desc") {
    return value;
  }
  return "asc";
}

function cleanParam(value: string | null): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error) }, { status: error.statusCode });
  }
  console.error("[api/roles]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
