import { NextRequest, NextResponse } from "next/server";
import { getSimpleEvent } from "@/lib/events";
import { getAttendeeStatus } from "@/lib/simple-events-sheets";
import { apiErrorResponse } from "@/lib/api-error";

// Always-fresh read right before someone confirms check-in.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getSimpleEvent(slug);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  try {
    const attendee = await getAttendeeStatus(event, userId);
    if (!attendee) return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
    return NextResponse.json(attendee);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
