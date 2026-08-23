import { NextRequest, NextResponse } from "next/server";
import { checkInAttendee, getActiveDay } from "@/lib/sheets";
import { DAYS, isDayId } from "@/lib/days";
import { apiErrorResponse } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const userId =
    typeof (body as { userId?: unknown })?.userId === "string"
      ? (body as { userId: string }).userId.trim()
      : "";
  if (!userId) {
    return NextResponse.json({ error: "Invalid attendee" }, { status: 400 });
  }

  const requestedDay = (body as { day?: unknown })?.day;

  try {
    const day = await getActiveDay();

    // The device resolved `day` when the check-in modal opened. If an admin
    // switched the active day while that modal was open, submitting against
    // the stale day would silently validate selections against the wrong
    // seminar list. Catch that here with a clear, specific error instead of
    // a confusing generic validation failure downstream.
    if (isDayId(requestedDay) && requestedDay !== day) {
      return NextResponse.json(
        {
          error: `The event day changed to ${DAYS[day].label} while this was open — please refresh and try again.`,
          dayChanged: true,
          day,
        },
        { status: 409 },
      );
    }

    const dayConfig = DAYS[day];

    const rawSelections = (body as { selections?: unknown })?.selections;
    const selections: Record<string, string> = {};
    if (rawSelections && typeof rawSelections === "object") {
      for (const session of dayConfig.sessions) {
        const value = (rawSelections as Record<string, unknown>)[session.slot];
        if (typeof value === "string" && session.options.some((o) => o.name === value)) {
          selections[session.slot] = value;
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
  } catch (err) {
    return apiErrorResponse(err);
  }
}
