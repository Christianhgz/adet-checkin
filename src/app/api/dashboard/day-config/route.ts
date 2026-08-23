import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DASHBOARD_COOKIE, dashboardToken } from "@/lib/auth";
import { DAYS } from "@/lib/days";
import { getActiveDay } from "@/lib/sheets";
import { apiErrorResponse } from "@/lib/api-error";

// Admin-only, deliberately uncached equivalent of the public /api/day-config
// (which is edge-cached for 5s to survive concurrent attendee traffic). The
// dashboard needs the true current day immediately after switching, not a
// value that could still reflect the day from before the switch.
export async function GET() {
  const store = await cookies();
  const authed = store.get(DASHBOARD_COOKIE)?.value === dashboardToken();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const day = await getActiveDay();
    const config = DAYS[day];
    return NextResponse.json({
      day: config.id,
      label: config.label,
      sessions: config.sessions,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
