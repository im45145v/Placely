import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { importApplicationsCsvForAdmin } from "@/lib/applications/service";
import { AppError, toUserMessage } from "@/lib/errors";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw AppError.validationError("CSV file is required.");
    }

    const content = await file.text();
    const rows = parseCsvImport(content);
    return NextResponse.json(await importApplicationsCsvForAdmin(actor, rows), { status: 202 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
    }
    console.error("[api/admin/applications/import]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
  }
}

function parseCsvImport(content: string) {
  const [headerLine, ...lines] = content.split(/\r?\n/).filter(Boolean);
  if (!headerLine) {
    throw AppError.validationError("CSV is empty.");
  }

  const headers = splitCsvLine(headerLine);
  const headerIndex = new Map(headers.map((header, index) => [header.trim(), index]));
  const actionIndex = headerIndex.get("action");
  const applicationIdIndex = headerIndex.get("applicationId");
  if (actionIndex === undefined || applicationIdIndex === undefined) {
    throw AppError.validationError("CSV must include applicationId and action columns.");
  }

  return lines.map((line) => {
    const cells = splitCsvLine(line);
    return {
      applicationId: cells[applicationIdIndex]?.trim() ?? "",
      action: (cells[actionIndex]?.trim() ?? "") as "shortlist" | "reject" | "move_to_round",
      roundId: cells[headerIndex.get("roundId") ?? -1]?.trim() || undefined,
      notes: cells[headerIndex.get("notes") ?? -1]?.trim() || undefined,
    };
  }).filter((row) => row.applicationId && row.action);
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}
