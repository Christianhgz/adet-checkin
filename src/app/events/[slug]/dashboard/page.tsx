import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getSimpleEvent, simpleEventSheetId } from "@/lib/events";
import { eventDashboardCookie, eventDashboardToken } from "@/lib/simple-events-auth";
import DashboardLogin from "./dashboard-login";
import DashboardView from "./dashboard-view";

export default async function EventDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getSimpleEvent(slug);
  if (!event) notFound();

  const store = await cookies();
  const authed = store.get(eventDashboardCookie(slug))?.value === eventDashboardToken();

  if (!authed) return <DashboardLogin slug={slug} label={event.label} />;

  let sheetUrl: string | null = null;
  try {
    sheetUrl = `https://docs.google.com/spreadsheets/d/${simpleEventSheetId(event)}/edit`;
  } catch {
    // Env var for this event's sheet isn't set yet — dashboard still loads,
    // just without the "open sheet" link; the roster fetch will surface the
    // real error.
  }
  return <DashboardView slug={slug} label={event.label} sheetUrl={sheetUrl} />;
}
