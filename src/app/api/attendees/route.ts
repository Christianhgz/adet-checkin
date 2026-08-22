import { NextResponse } from "next/server";
import { getActiveDay, getRoster } from "@/lib/sheets";

export async function GET() {
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
}
