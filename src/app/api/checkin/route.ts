import { NextRequest, NextResponse } from "next/server";
import { checkInAttendee, getRoster } from "@/lib/sheets";
import { EVENTS, REQUIRED_EVENT_COUNT } from "@/lib/events";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const row = Number(body?.row);
  if (!Number.isInteger(row) || row < 2) {
    return NextResponse.json({ error: "Invalid row" }, { status: 400 });
  }

  const rawEvents = Array.isArray(body?.events) ? body.events : [];
  const events = [...new Set(rawEvents)].filter(
    (e): e is string => typeof e === "string" && (EVENTS as readonly string[]).includes(e),
  );

  const roster = await getRoster();
  const attendee = roster.find((a) => a.row === row);
  if (!attendee) {
    return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
  }

  const result = await checkInAttendee(row, events);
  if (result.status === "invalid_event_count") {
    return NextResponse.json(
      { error: `Select exactly ${REQUIRED_EVENT_COUNT} of the ${EVENTS.length} events before checking in` },
      { status: 400 },
    );
  }

  return NextResponse.json({
    firstName: attendee.firstName,
    lastName: attendee.lastName,
    alreadyCheckedIn: result.status === "already",
    checkedInAt: result.checkedInAt,
    events: result.events,
  });
}
