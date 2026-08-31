import { NextResponse } from "next/server";
import { requireAuthenticatedAppUser } from "@/lib/auth/guards";
import { getStorageFileForActor } from "@/lib/companies/service";
import { AppError, toUserMessage } from "@/lib/errors";

export async function GET(
  _request: Request,
  context: { params: Promise<{ companyId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireAuthenticatedAppUser();
    const { companyId } = await context.params;
    const { metadata, file } = await getStorageFileForActor(actor, "company_logo", companyId);
    return new NextResponse(file, {
      headers: {
        "Content-Type": metadata.mimeType,
        "Content-Disposition": `inline; filename="${metadata.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.code, message: toUserMessage(error) }, { status: error.statusCode });
  }
  console.error("[api/files/company-logo/[companyId]]", error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
}
