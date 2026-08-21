import { NextRequest, NextResponse } from "next/server";
import { getRoster, searchAttendees } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const roster = await getRoster();
  const matches = searchAttendees(roster, q);
  return NextResponse.json({
    matches: matches.map((a) => ({
      row: a.row,
      firstName: a.firstName,
      lastName: a.lastName,
      events: a.events,
      checkedIn: a.checkedIn,
    })),
  });
}
