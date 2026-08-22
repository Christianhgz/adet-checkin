import { NextResponse } from "next/server";
import { computeAvailability, getActiveDay, getRoster } from "@/lib/sheets";
import { apiErrorResponse } from "@/lib/api-error";

export const revalidate = 5;

export async function GET() {
  try {
    const day = await getActiveDay();
    const roster = await getRoster(day);
    return NextResponse.json({ availability: computeAvailability(roster, day) });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
