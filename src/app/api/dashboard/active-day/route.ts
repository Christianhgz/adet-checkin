import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DASHBOARD_COOKIE, dashboardToken } from "@/lib/auth";
import { DAYS, DayId } from "@/lib/days";
import { getActiveDay, setActiveDay } from "@/lib/sheets";

async function requireAuth() {
  const store = await cookies();
  return store.get(DASHBOARD_COOKIE)?.value === dashboardToken();
}

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const day = await getActiveDay();
  return NextResponse.json({ day, label: DAYS[day].label });
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const day = body?.day;
  if (day !== "saturday" && day !== "sunday") {
    return NextResponse.json({ error: "Invalid day" }, { status: 400 });
  }
  await setActiveDay(day as DayId);
  return NextResponse.json({ day, label: DAYS[day as DayId].label });
}
