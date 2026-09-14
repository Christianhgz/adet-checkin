import { NextRequest, NextResponse } from "next/server";
import { getSimpleEvent } from "@/lib/events";
import { checkIn } from "@/lib/simple-events-sheets";
import { apiErrorResponse } from "@/lib/api-error";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getSimpleEvent(slug);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const userId =
    typeof (body as { userId?: unknown })?.userId === "string"
      ? (body as { userId: string }).userId.trim()
      : "";
  if (!userId) return NextResponse.json({ error: "Invalid attendee" }, { status: 400 });

  try {
    const result = await checkIn(event, userId);
    if (result.status === "not_found") {
      return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
    }
    return NextResponse.json({
      alreadyCheckedIn: result.status === "already",
      checkedInAt: result.checkedInAt,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
