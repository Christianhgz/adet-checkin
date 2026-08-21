import { google, sheets_v4 } from "googleapis";
import { EVENTS, EVENT_INFO, EventName, TIME_SLOTS, TimeSlot } from "./events";

const SHEET_NAME = "Sheet1";
const DATA_RANGE = `${SHEET_NAME}!A2:M1000`;
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
  slots: Partial<Record<TimeSlot, EventName>>;
};

export type SlotAvailability = {
  slot: TimeSlot;
  event: EventName;
  location: string;
  capacity: number;
  taken: number;
  full: boolean;
};

export type Metrics = {
  totalRegistered: number;
  totalCheckedIn: number;
  checkInRate: number;
  perEvent: { event: string; attendees: number }[];
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

function columnsToSlots(columns: (string | undefined)[]): Partial<Record<TimeSlot, EventName>> {
  const slots: Partial<Record<TimeSlot, EventName>> = {};
  TIME_SLOTS.forEach((slot, i) => {
    const value = (columns[i] ?? "").trim();
    if ((EVENTS as readonly string[]).includes(value)) {
      slots[slot] = value as EventName;
    }
  });
  return slots;
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
    s1 = "",
    s2 = "",
    s3 = "",
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
    slots: columnsToSlots([s1, s2, s3]),
  };
}

let cache: { data: Attendee[]; expiresAt: number } | null = null;

async function fetchRoster(): Promise<Attendee[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: DATA_RANGE,
  });
  const rows = res.data.values ?? [];
  return rows
    .map((row, index) => rowToAttendee(row as string[], index))
    .filter((a) => a.firstName || a.lastName);
}

export async function getRoster(): Promise<Attendee[]> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }
  const data = await fetchRoster();
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export function computeAvailability(roster: Attendee[]): SlotAvailability[] {
  const availability: SlotAvailability[] = [];
  for (const slot of TIME_SLOTS) {
    for (const event of EVENTS) {
      const info = EVENT_INFO[event];
      const taken = roster.filter((a) => a.checkedIn && a.slots[slot] === event).length;
      availability.push({
        slot,
        event,
        location: info.location,
        capacity: info.capacity,
        taken,
        full: taken >= info.capacity,
      });
    }
  }
  return availability;
}

export type CheckInOutcome =
  | { status: "already"; checkedInAt: string; selections: Partial<Record<TimeSlot, EventName>> }
  | { status: "checked_in"; checkedInAt: string; selections: Partial<Record<TimeSlot, EventName>> }
  | { status: "invalid_selection"; message: string }
  | { status: "slot_full"; slot: TimeSlot; event: EventName };

export async function checkInAttendee(
  row: number,
  selections: Partial<Record<TimeSlot, EventName>>,
): Promise<CheckInOutcome> {
  // Fresh (uncached) read of the whole roster: needed both to confirm this
  // row isn't already checked in, and to get an accurate capacity count for
  // every slot right before writing, minimizing the race window.
  const roster = await fetchRoster();
  const attendee = roster.find((a) => a.row === row);

  if (attendee?.checkedIn) {
    return {
      status: "already",
      checkedInAt: attendee.checkedInAt ?? "",
      selections: attendee.slots,
    };
  }

  const chosenSlots = TIME_SLOTS.filter((slot) => selections[slot]);
  if (chosenSlots.length !== TIME_SLOTS.length) {
    return { status: "invalid_selection", message: "Pick one session for every time slot." };
  }
  const chosenEvents = TIME_SLOTS.map((slot) => selections[slot] as EventName);
  const uniqueEvents = new Set(chosenEvents);
  if (uniqueEvents.size !== TIME_SLOTS.length) {
    return { status: "invalid_selection", message: "Each time slot must have a different session." };
  }
  for (const event of chosenEvents) {
    if (!(EVENTS as readonly string[]).includes(event)) {
      return { status: "invalid_selection", message: "Invalid session selected." };
    }
  }

  const availability = computeAvailability(roster);
  for (const slot of TIME_SLOTS) {
    const event = selections[slot] as EventName;
    const slotAvailability = availability.find((a) => a.slot === slot && a.event === event);
    if (slotAvailability?.full) {
      return { status: "slot_full", slot, event };
    }
  }

  const sheets = getClient();
  const now = new Date().toISOString();
  const eventColumns = EVENTS.map((name) => (uniqueEvents.has(name) ? "YES" : "NO"));
  const slotColumns = TIME_SLOTS.map((slot) => selections[slot] as EventName);
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!D${row}:M${row}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[...eventColumns, String(chosenEvents.length), "TRUE", now, ...slotColumns]],
    },
  });
  cache = null;
  return { status: "checked_in", checkedInAt: now, selections };
}

export function computeMetrics(roster: Attendee[]): Metrics {
  const totalRegistered = roster.length;
  const totalCheckedIn = roster.filter((a) => a.checkedIn).length;

  const perEvent = EVENTS.map((event) => ({
    event,
    attendees: roster.filter((a) => a.events.includes(event)).length,
  }));

  return {
    totalRegistered,
    totalCheckedIn,
    checkInRate: totalRegistered ? totalCheckedIn / totalRegistered : 0,
    perEvent,
  };
}
