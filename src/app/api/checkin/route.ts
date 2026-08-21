import { NextRequest, NextResponse } from "next/server";
import { checkInAttendee, getRoster } from "@/lib/sheets";
import { EVENTS, EventName, TIME_SLOTS, TimeSlot } from "@/lib/events";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const row = Number(body?.row);
  if (!Number.isInteger(row) || row < 2) {
    return NextResponse.json({ error: "Invalid row" }, { status: 400 });
  }

  const rawSelections = body?.selections;
  const selections: Partial<Record<TimeSlot, EventName>> = {};
  if (rawSelections && typeof rawSelections === "object") {
    for (const slot of TIME_SLOTS) {
      const value = rawSelections[slot];
      if (typeof value === "string" && (EVENTS as readonly string[]).includes(value)) {
        selections[slot] = value as EventName;
      }
    }
  }

  const roster = await getRoster();
  const attendee = roster.find((a) => a.row === row);
  if (!attendee) {
    return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
  }

  const result = await checkInAttendee(row, selections);

  if (result.status === "invalid_selection") {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }
  if (result.status === "slot_full") {
    return NextResponse.json(
      { error: `${result.event} at ${result.slot} just filled up — please pick a different session.` },
      { status: 409 },
    );
  }

  return NextResponse.json({
    firstName: attendee.firstName,
    lastName: attendee.lastName,
    alreadyCheckedIn: result.status === "already",
    checkedInAt: result.checkedInAt,
    selections: result.selections,
  });
}
