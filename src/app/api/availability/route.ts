import { NextResponse } from "next/server";
import { computeAvailability, getRoster } from "@/lib/sheets";

export async function GET() {
  const roster = await getRoster();
  return NextResponse.json({ availability: computeAvailability(roster) });
}
