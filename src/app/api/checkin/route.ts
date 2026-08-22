import { NextRequest, NextResponse } from "next/server";
import { checkInAttendee, getActiveDay } from "@/lib/sheets";
import { DAYS } from "@/lib/days";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "Invalid attendee" }, { status: 400 });
  }

  const day = await getActiveDay();
  const dayConfig = DAYS[day];

  const rawSelections = body?.selections;
  const selections: Record<string, string> = {};
  if (rawSelections && typeof rawSelections === "object") {
    for (const slot of dayConfig.timeSlots) {
      const value = rawSelections[slot];
      if (typeof value === "string" && dayConfig.events.includes(value)) {
        selections[slot] = value;
      }
    }
  }

  const result = await checkInAttendee(day, userId, selections);

  if (result.status === "not_found") {
    return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
  }
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
    alreadyCheckedIn: result.status === "already",
    checkedInAt: result.checkedInAt,
    selections: result.selections,
  });
}
