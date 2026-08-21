import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DASHBOARD_COOKIE, dashboardToken } from "@/lib/auth";
import { computeMetrics, getRoster } from "@/lib/sheets";

export async function GET() {
  const store = await cookies();
  const authed = store.get(DASHBOARD_COOKIE)?.value === dashboardToken();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roster = await getRoster();
  return NextResponse.json(computeMetrics(roster));
}
