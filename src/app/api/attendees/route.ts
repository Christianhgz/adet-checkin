import { NextResponse } from "next/server";
import { getRoster } from "@/lib/sheets";

export async function GET() {
  try {
    const roster = await getRoster();
    return NextResponse.json({
      attendees: roster.map((a) => ({
        row: a.row,
        firstName: a.firstName,
        lastName: a.lastName,
        events: a.events,
        checkedIn: a.checkedIn,
        checkedInAt: a.checkedInAt,
      })),
    });
  } catch (err) {
    // TEMP: surface the real error for production debugging; remove once the env var issue is confirmed fixed.
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
        hasEmail: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
        hasKey: Boolean(process.env.GOOGLE_PRIVATE_KEY),
        hasSheetId: Boolean(process.env.GOOGLE_SHEET_ID),
      },
      { status: 500 },
    );
  }
}
