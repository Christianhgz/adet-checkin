import { NextResponse } from "next/server";
import { getActiveDay, getRoster } from "@/lib/sheets";
import { apiErrorResponse } from "@/lib/api-error";

// Cache at Vercel's edge for 5s: under a burst of concurrent devices, this
// means one Sheets API read serves everyone in that window instead of one
// per request — the single biggest lever against quota exhaustion, since it
// works across separate serverless instances (in-memory caching doesn't).
export const revalidate = 5;

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
