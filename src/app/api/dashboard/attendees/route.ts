import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DASHBOARD_COOKIE, dashboardToken } from "@/lib/auth";
import { getActiveDay, getRoster } from "@/lib/sheets";

export async function GET() {
  const store = await cookies();
  const authed = store.get(DASHBOARD_COOKIE)?.value === dashboardToken();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const day = await getActiveDay();
  const roster = await getRoster(day);
  return NextResponse.json({
    attendees: roster.map((a) => ({
      userId: a.userId,
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.email,
      checkedIn: a.checkedIn,
      checkedInAt: a.checkedInAt,
      slots: a.slots,
    })),
  });
}
