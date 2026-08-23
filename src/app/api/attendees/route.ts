import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getActiveDay, getRoster } from "@/lib/sheets";
import { apiErrorResponse } from "@/lib/api-error";
import { DayId, isDayId } from "@/lib/days";

// Reading `nextUrl.searchParams` below forces this route to render
// dynamically, which would silently disable the route-level `revalidate`
// edge cache Vercel would otherwise give a static response — the single
// biggest lever against quota exhaustion under a burst of concurrent
// devices. `unstable_cache` restores an equivalent shared cache (Next's
// Data Cache, durable across separate serverless instances) keyed on the
// resolved `day`, so callers can pass an explicit day without losing that
// protection.
const getCachedRoster = unstable_cache(
  async (day: DayId) => getRoster(day),
  ["public-attendees-roster"],
  { revalidate: 5 },
);

export async function GET(req: NextRequest) {
  try {
    // The client resolves "which day" once via /api/day-config and passes
    // it here explicitly, so the two fetches in one page load can't
    // disagree even if a switch lands in the gap between them. Falls back
    // to resolving it independently for any caller that doesn't pass one.
    const requested = req.nextUrl.searchParams.get("day");
    const day = isDayId(requested) ? requested : await getActiveDay();
    const roster = await getCachedRoster(day);
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
    return apiErrorResponse(err);
  }
}
