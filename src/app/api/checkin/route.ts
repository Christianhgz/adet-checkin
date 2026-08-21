import { NextRequest, NextResponse } from "next/server";
import { checkInAttendee, getRoster } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const row = Number(body?.row);
  if (!Number.isInteger(row) || row < 2) {
    return NextResponse.json({ error: "Invalid row" }, { status: 400 });
  }

  const roster = await getRoster();
  const attendee = roster.find((a) => a.row === row);
  if (!attendee) {
    return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
  }

  const result = await checkInAttendee(row);
  return NextResponse.json({
    firstName: attendee.firstName,
    lastName: attendee.lastName,
    events: attendee.events,
    ...result,
  });
}
