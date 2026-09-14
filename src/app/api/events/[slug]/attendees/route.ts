import { NextResponse } from "next/server";
import { getSimpleEvent } from "@/lib/events";
import { getRoster } from "@/lib/simple-events-sheets";
import { apiErrorResponse } from "@/lib/api-error";

// Small guest list (~20 people) — no edge/in-memory caching needed the way
// ADET's high-concurrency public routes require it.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getSimpleEvent(slug);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  try {
    const roster = await getRoster(event);
    return NextResponse.json({ label: event.label, attendees: roster });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
