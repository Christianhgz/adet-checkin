import { NextRequest, NextResponse } from "next/server";
import { getSimpleEvent } from "@/lib/events";
import { eventDashboardCookie, eventDashboardToken } from "@/lib/simple-events-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getSimpleEvent(slug);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { password } = await req.json();
  const expected = process.env.DASHBOARD_PASSWORD ?? "";
  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(eventDashboardCookie(slug), eventDashboardToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
