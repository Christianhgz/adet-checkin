import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DASHBOARD_COOKIE, dashboardToken } from "@/lib/auth";
import { computeMetrics, getActiveDay, getRosterFresh } from "@/lib/sheets";
import { apiErrorResponse } from "@/lib/api-error";
import { isDayId } from "@/lib/days";

export async function GET(req: NextRequest) {
  const store = await cookies();
  const authed = store.get(DASHBOARD_COOKIE)?.value === dashboardToken();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Prefer the day the client already resolved for this render cycle
    // (via /api/dashboard/day-config) over re-resolving independently, so a
    // switch mid-flight can't make this endpoint disagree with the others.
    const requested = req.nextUrl.searchParams.get("day");
    const day = isDayId(requested) ? requested : await getActiveDay();
    const roster = await getRosterFresh(day);
    return NextResponse.json(computeMetrics(roster, day));
  } catch (err) {
    return apiErrorResponse(err);
  }
}
