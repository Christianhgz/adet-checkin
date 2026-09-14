import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSimpleEvent } from "@/lib/events";
import { getRoster } from "@/lib/simple-events-sheets";
import { eventDashboardCookie, eventDashboardToken } from "@/lib/simple-events-auth";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getSimpleEvent(slug);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const store = await cookies();
  const authed = store.get(eventDashboardCookie(slug))?.value === eventDashboardToken();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const roster = await getRoster(event);
    return NextResponse.json({ attendees: roster });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
