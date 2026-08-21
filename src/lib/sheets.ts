import { google, sheets_v4 } from "googleapis";
import { EVENTS, MIN_EVENTS_REQUIRED } from "./events";

const SHEET_NAME = "Sheet1";
const DATA_RANGE = `${SHEET_NAME}!A2:J1000`;
const CACHE_TTL_MS = 10_000;

export type Attendee = {
  row: number;
  firstName: string;
  lastName: string;
  email: string;
  events: string[];
  totalEvents: string;
  checkedIn: boolean;
  checkedInAt: string | null;
};

export type Metrics = {
  totalRegistered: number;
  totalCheckedIn: number;
  checkInRate: number;
  perEvent: { event: string; registered: number; checkedIn: number }[];
  checkInsOverTime: { time: string; count: number }[];
};

let client: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (client) return client;
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  client = google.sheets({ version: "v4", auth });
  return client;
}

function columnsToEvents(columns: (string | undefined)[]): string[] {
  return EVENTS.filter((_, i) => (columns[i] ?? "").trim().toUpperCase() === "YES");
}

function rowToAttendee(row: string[], index: number): Attendee {
  const [
    firstName = "",
    lastName = "",
    email = "",
    e1 = "",
    e2 = "",
    e3 = "",
    e4 = "",
    totalEvents = "",
    checkedIn = "",
    checkedInAt = "",
  ] = row;
  return {
    row: index + 2, // +2: header row + 1-indexing
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim(),
    events: columnsToEvents([e1, e2, e3, e4]),
    totalEvents: totalEvents.trim(),
    checkedIn: checkedIn.trim().toUpperCase() === "TRUE",
    checkedInAt: checkedInAt.trim() || null,
  };
}

let cache: { data: Attendee[]; expiresAt: number } | null = null;

export async function getRoster(): Promise<Attendee[]> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: DATA_RANGE,
  });
  const rows = res.data.values ?? [];
  const data = rows
    .map((row, index) => rowToAttendee(row as string[], index))
    .filter((a) => a.firstName || a.lastName);
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export type CheckInOutcome =
  | { status: "already"; checkedInAt: string; events: string[] }
  | { status: "checked_in"; checkedInAt: string; events: string[] }
  | { status: "insufficient_events" };

export async function checkInAttendee(
  row: number,
  selectedEvents: string[],
): Promise<CheckInOutcome> {
  const sheets = getClient();
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!D${row}:J${row}`,
  });
  const [e1 = "", e2 = "", e3 = "", e4 = "", , checkedIn = "", checkedInAt = ""] =
    existing.data.values?.[0] ?? [];
  if (typeof checkedIn === "string" && checkedIn.trim().toUpperCase() === "TRUE") {
    return {
      status: "already",
      checkedInAt: checkedInAt ?? "",
      events: columnsToEvents([e1, e2, e3, e4]),
    };
  }

  if (selectedEvents.length < MIN_EVENTS_REQUIRED) {
    return { status: "insufficient_events" };
  }

  const now = new Date().toISOString();
  const eventColumns = EVENTS.map((name) => (selectedEvents.includes(name) ? "YES" : "NO"));
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!D${row}:J${row}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[...eventColumns, String(selectedEvents.length), "TRUE", now]],
    },
  });
  cache = null;
  return { status: "checked_in", checkedInAt: now, events: selectedEvents };
}

export function computeMetrics(roster: Attendee[]): Metrics {
  const totalRegistered = roster.length;
  const checkedInList = roster.filter((a) => a.checkedIn);
  const totalCheckedIn = checkedInList.length;

  const eventMap = new Map<string, { registered: number; checkedIn: number }>();
  for (const a of roster) {
    for (const ev of a.events) {
      const entry = eventMap.get(ev) ?? { registered: 0, checkedIn: 0 };
      entry.registered += 1;
      if (a.checkedIn) entry.checkedIn += 1;
      eventMap.set(ev, entry);
    }
  }

  const checkInsOverTime = checkedInList
    .filter((a): a is Attendee & { checkedInAt: string } => Boolean(a.checkedInAt))
    .sort((a, b) => (a.checkedInAt < b.checkedInAt ? -1 : 1))
    .map((a, i) => ({ time: a.checkedInAt, count: i + 1 }));

  return {
    totalRegistered,
    totalCheckedIn,
    checkInRate: totalRegistered ? totalCheckedIn / totalRegistered : 0,
    perEvent: Array.from(eventMap.entries()).map(([event, v]) => ({ event, ...v })),
    checkInsOverTime,
  };
}
