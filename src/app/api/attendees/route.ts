import { NextResponse } from "next/server";
import { getActiveDay, getRoster } from "@/lib/sheets";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET() {
  try {
    const day = await getActiveDay();
    const roster = await getRoster(day);
    return NextResponse.json({
      attendees: roster.map((a) => ({
        userId: a.userId,
        firstName: a.firstName,
        lastName: a.lastName,
        events: a.events,
        checkedIn: a.checkedIn,
        checkedInAt: a.checkedInAt,
        slots: a.slots,
      })),
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
