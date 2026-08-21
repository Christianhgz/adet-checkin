import { NextResponse } from "next/server";
import { getRoster } from "@/lib/sheets";

export async function GET() {
  const roster = await getRoster();
  return NextResponse.json({
    attendees: roster.map((a) => ({
      row: a.row,
      firstName: a.firstName,
      lastName: a.lastName,
      events: a.events,
      checkedIn: a.checkedIn,
      checkedInAt: a.checkedInAt,
    })),
  });
}
