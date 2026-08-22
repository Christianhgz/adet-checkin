import { NextResponse } from "next/server";
import { DAYS } from "@/lib/days";
import { getActiveDay } from "@/lib/sheets";

export async function GET() {
  const day = await getActiveDay();
  const config = DAYS[day];
  return NextResponse.json({
    day: config.id,
    label: config.label,
    events: config.events,
    timeSlots: config.timeSlots,
    eventInfo: config.eventInfo,
  });
}
