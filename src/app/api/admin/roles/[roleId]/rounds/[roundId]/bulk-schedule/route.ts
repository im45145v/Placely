import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { bulkScheduleRoundParticipantsForAdmin } from "@/lib/applications/service";
import { AppError, toUserMessage } from "@/lib/errors";

const ADMIN_ROLES = [USER_ROLES.PLACEMENT_ADMIN, USER_ROLES.SUPER_ADMIN] as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ roleId: string; roundId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await requireRoleAccess(ADMIN_ROLES);
    const { roundId } = await context.params;
    const body = await request.json() as {
      participantIds?: string[];
      slots?: Array<{
        scheduledStart?: string;
        scheduledEnd?: string;
        slotLabel?: string;
        room?: string;
        location?: string;
        meetingLink?: string;
        interviewerIds?: string[];
        instructions?: string;
        scheduleTimezone?: string;
      }>;
    };
    return NextResponse.json(await bulkScheduleRoundParticipantsForAdmin(actor, roundId, {
      participantIds: Array.isArray(body.participantIds) ? body.participantIds.map(String).filter(Boolean) : [],
      slots: Array.isArray(body.slots)
        ? body.slots.map((slot) => ({
            scheduledStart: String(slot.scheduledStart ?? ""),
            scheduledEnd: String(slot.scheduledEnd ?? ""),
            slotLabel: typeof slot.slotLabel === "string" ? slot.slotLabel : undefined,
            room: typeof slot.room === "string" ? slot.room : undefined,
            location: typeof slot.location === "string" ? slot.location : undefined,
            meetingLink: typeof slot.meetingLink === "string" ? slot.meetingLink : undefined,
            interviewerIds: Array.isArray(slot.interviewerIds) ? slot.interviewerIds.map(String).filter(Boolean) : undefined,
            instructions: typeof slot.instructions === "string" ? slot.instructions : undefined,
            scheduleTimezone: typeof slot.scheduleTimezone === "string" ? slot.scheduleTimezone : undefined,
          }))
        : [],
    }));
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.code, message: toUserMessage(error), details: error.details }, { status: error.statusCode });
    }
    console.error("[api/admin/roles/[roleId]/rounds/[roundId]/bulk-schedule]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, { status: 500 });
  }
}
