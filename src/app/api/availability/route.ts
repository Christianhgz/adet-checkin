import { NextResponse } from "next/server";
import { computeAvailability, getActiveDay, getRoster } from "@/lib/sheets";
import { apiErrorResponse } from "@/lib/api-error";

// Only the (single, admin-only) dashboard polls this — no concurrent-device
// scale to protect against, and it needs to be fresh right after the admin
// switches the active day, so unlike the public endpoints this stays
// uncached.
export async function GET() {
  try {
    const day = await getActiveDay();
    const roster = await getRoster(day);
    return NextResponse.json({ availability: computeAvailability(roster, day) });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
