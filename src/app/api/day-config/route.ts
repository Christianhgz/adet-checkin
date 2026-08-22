import { NextResponse } from "next/server";
import { DAYS } from "@/lib/days";
import { getActiveDay } from "@/lib/sheets";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET() {
  try {
    const day = await getActiveDay();
    const config = DAYS[day];
    return NextResponse.json({
      day: config.id,
      label: config.label,
      events: config.events,
      timeSlots: config.timeSlots,
      eventInfo: config.eventInfo,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
