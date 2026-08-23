import { NextRequest, NextResponse } from "next/server";
import { getActiveDay, getFreshAttendeeStatus } from "@/lib/sheets";
import { apiErrorResponse } from "@/lib/api-error";

// Deliberately not edge-cached (no `revalidate` export): this is the
// correctness-critical check right before someone confirms a check-in, so it
// always needs the true current state, not a value that could be a few
// seconds stale.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }
  try {
    const day = await getActiveDay();
    const attendee = await getFreshAttendeeStatus(day, userId);
    if (!attendee) {
      return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
    }
    return NextResponse.json({
      day,
      userId: attendee.userId,
      firstName: attendee.firstName,
      lastName: attendee.lastName,
      events: attendee.events,
      checkedIn: attendee.checkedIn,
      checkedInAt: attendee.checkedInAt,
      slots: attendee.slots,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
