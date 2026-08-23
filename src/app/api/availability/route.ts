import { NextRequest, NextResponse } from "next/server";
import { computeAvailability, getActiveDay, getRosterFresh } from "@/lib/sheets";
import { apiErrorResponse } from "@/lib/api-error";
import { isDayId } from "@/lib/days";

// Only the (single, admin-only) dashboard polls this — no concurrent-device
// scale to protect against, and it needs to be fresh right after the admin
// switches the active day, so unlike the public endpoints this stays
// uncached.
export async function GET(req: NextRequest) {
  try {
    const requested = req.nextUrl.searchParams.get("day");
    const day = isDayId(requested) ? requested : await getActiveDay();
    const roster = await getRosterFresh(day);
    return NextResponse.json({ availability: computeAvailability(roster, day) });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
