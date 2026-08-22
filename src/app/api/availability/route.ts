import { NextResponse } from "next/server";
import { computeAvailability, getActiveDay, getRoster } from "@/lib/sheets";

export async function GET() {
  const day = await getActiveDay();
  const roster = await getRoster(day);
  return NextResponse.json({ availability: computeAvailability(roster, day) });
}
