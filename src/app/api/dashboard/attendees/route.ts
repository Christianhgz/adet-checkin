import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DASHBOARD_COOKIE, dashboardToken } from "@/lib/auth";
import { getActiveDay, getRosterFresh } from "@/lib/sheets";
import { apiErrorResponse } from "@/lib/api-error";
import { isDayId } from "@/lib/days";

export async function GET(req: NextRequest) {
  const store = await cookies();
  const authed = store.get(DASHBOARD_COOKIE)?.value === dashboardToken();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const requested = req.nextUrl.searchParams.get("day");
    const day = isDayId(requested) ? requested : await getActiveDay();
    const roster = await getRosterFresh(day);
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
  } catch (err) {
    return apiErrorResponse(err);
  }
}
