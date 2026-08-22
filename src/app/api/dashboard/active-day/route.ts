import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DASHBOARD_COOKIE, dashboardToken } from "@/lib/auth";
import { DAYS, DayId } from "@/lib/days";
import { getActiveDay, setActiveDay } from "@/lib/sheets";
import { apiErrorResponse } from "@/lib/api-error";

async function requireAuth() {
  const store = await cookies();
  return store.get(DASHBOARD_COOKIE)?.value === dashboardToken();
}

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const day = await getActiveDay();
    return NextResponse.json({ day, label: DAYS[day].label });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const day = (body as { day?: unknown })?.day;
  if (day !== "saturday" && day !== "sunday") {
    return NextResponse.json({ error: "Invalid day" }, { status: 400 });
  }

  try {
    await setActiveDay(day as DayId);
    return NextResponse.json({ day, label: DAYS[day as DayId].label });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
