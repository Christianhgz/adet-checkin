import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DASHBOARD_COOKIE, dashboardToken } from "@/lib/auth";
import { computeMetrics, getActiveDay, getRoster } from "@/lib/sheets";

export async function GET() {
  const store = await cookies();
  const authed = store.get(DASHBOARD_COOKIE)?.value === dashboardToken();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const day = await getActiveDay();
  const roster = await getRoster(day);
  return NextResponse.json(computeMetrics(roster, day));
}
