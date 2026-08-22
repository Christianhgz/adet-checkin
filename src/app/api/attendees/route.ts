import { NextResponse } from "next/server";
import { getActiveDay, getRoster } from "@/lib/sheets";

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
    // TEMP debug — remove once load-test diagnosis is complete.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined },
      { status: 500 },
    );
  }
}
