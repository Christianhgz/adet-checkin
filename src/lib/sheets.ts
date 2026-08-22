import { google, sheets_v4 } from "googleapis";
import { CONFIG_SHEET_NAME, DAYS, DayConfig, DayId, USERS_SHEET_NAME } from "./days";

const CACHE_TTL_MS = 10_000;

export type Attendee = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  events: string[];
  totalEvents: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  slots: Record<string, string>;
};

export type SlotAvailability = {
  slot: string;
  event: string;
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

// 0-based column index -> spreadsheet column letter (A, B, ... Z, AA, ...).
function colLetter(index: number): string {
  let n = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

// Column layout of a day tab, relative to column A (user-id):
// A: user-id | B..: one column per event | then total-events, checked-in,
// checked-in-at | then one column per time slot.
function dayColumns(day: DayConfig) {
  const eventsStart = 1;
  const totalEventsCol = eventsStart + day.events.length;
  const checkedInCol = totalEventsCol + 1;
  const checkedInAtCol = checkedInCol + 1;
  const slotsStart = checkedInAtCol + 1;
  const lastCol = slotsStart + day.timeSlots.length - 1;
  return { eventsStart, totalEventsCol, checkedInCol, checkedInAtCol, slotsStart, lastCol };
}

// -------------------- active day config --------------------

let activeDayCache: { value: DayId; expiresAt: number } | null = null;

export async function getActiveDay(): Promise<DayId> {
  if (activeDayCache && activeDayCache.expiresAt > Date.now()) {
    return activeDayCache.value;
  }
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${CONFIG_SHEET_NAME}!A2:B2`,
  });
  const value = (res.data.values?.[0]?.[1] ?? "").trim().toLowerCase();
  const day: DayId = value === "sunday" ? "sunday" : "saturday";
  activeDayCache = { value: day, expiresAt: Date.now() + CACHE_TTL_MS };
  return day;
}

export async function setActiveDay(day: DayId): Promise<void> {
  const sheets = getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${CONFIG_SHEET_NAME}!A2:B2`,
    valueInputOption: "RAW",
    requestBody: { values: [["active-day", day]] },
  });
  activeDayCache = null;
  rosterCache = null;
}

// -------------------- users (identity, shared across days) --------------------

type UserRecord = { firstName: string; lastName: string; email: string };

let usersCache: { data: Map<string, UserRecord>; expiresAt: number } | null = null;

async function getUsers(): Promise<Map<string, UserRecord>> {
  if (usersCache && usersCache.expiresAt > Date.now()) {
    return usersCache.data;
  }
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${USERS_SHEET_NAME}!A2:D1000`,
  });
  const rows = res.data.values ?? [];
  const map = new Map<string, UserRecord>();
  for (const row of rows) {
    const [userId = "", firstName = "", lastName = "", email = ""] = row;
    if (!userId.trim()) continue;
    map.set(userId.trim(), {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
    });
  }
  usersCache = { data: map, expiresAt: Date.now() + CACHE_TTL_MS };
  return map;
}

// -------------------- day roster (per-day check-in data, joined with users) --------------------

function parseDayRow(row: string[], day: DayConfig): Omit<Attendee, "firstName" | "lastName" | "email"> {
  const cols = dayColumns(day);
  const userId = (row[0] ?? "").trim();
  const eventCells = row.slice(cols.eventsStart, cols.eventsStart + day.events.length);
  const totalEvents = (row[cols.totalEventsCol] ?? "").trim();
  const checkedIn = (row[cols.checkedInCol] ?? "").trim().toUpperCase() === "TRUE";
  const checkedInAt = (row[cols.checkedInAtCol] ?? "").trim() || null;
  const slotCells = row.slice(cols.slotsStart, cols.slotsStart + day.timeSlots.length);

  const events = day.events.filter((_, i) => (eventCells[i] ?? "").trim().toUpperCase() === "YES");
  const slots: Record<string, string> = {};
  day.timeSlots.forEach((slot, i) => {
    const value = (slotCells[i] ?? "").trim();
    if (day.events.includes(value)) slots[slot] = value;
  });

  return { userId, events, totalEvents, checkedIn, checkedInAt, slots };
}

let rosterCache: { day: DayId; data: Attendee[]; expiresAt: number } | null = null;

async function fetchDayRoster(day: DayConfig): Promise<Attendee[]> {
  const sheets = getClient();
  const cols = dayColumns(day);
  const range = `${day.sheetName}!A2:${colLetter(cols.lastCol)}1000`;
  const [dayRes, users] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range }),
    getUsers(),
  ]);
  const rows = dayRes.data.values ?? [];
  return rows
    .map((row) => parseDayRow(row as string[], day))
    .filter((r) => r.userId)
    .map((r) => {
      const user = users.get(r.userId) ?? { firstName: "", lastName: "", email: "" };
      return { ...r, ...user };
    })
    .filter((a) => a.firstName || a.lastName);
}

export async function getRoster(day: DayId): Promise<Attendee[]> {
  if (rosterCache && rosterCache.day === day && rosterCache.expiresAt > Date.now()) {
    return rosterCache.data;
  }
  const data = await fetchDayRoster(DAYS[day]);
  rosterCache = { day, data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export function computeAvailability(roster: Attendee[], day: DayId): SlotAvailability[] {
  const dayConfig = DAYS[day];
  const availability: SlotAvailability[] = [];
  for (const slot of dayConfig.timeSlots) {
    for (const event of dayConfig.events) {
      const info = dayConfig.eventInfo[event];
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
  | { status: "already"; checkedInAt: string; selections: Record<string, string> }
  | { status: "checked_in"; checkedInAt: string; selections: Record<string, string> }
  | { status: "invalid_selection"; message: string }
  | { status: "slot_full"; slot: string; event: string }
  | { status: "not_found" };

export async function checkInAttendee(
  day: DayId,
  userId: string,
  selections: Record<string, string>,
): Promise<CheckInOutcome> {
  const dayConfig = DAYS[day];
  const cols = dayColumns(dayConfig);
  const sheets = getClient();

  // Fresh (uncached) read of the whole day tab: needed both to find this
  // user's row + confirm they're not already checked in, and to get an
  // accurate capacity count for every slot right before writing.
  const range = `${dayConfig.sheetName}!A2:${colLetter(cols.lastCol)}1000`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range,
  });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((r) => (r[0] ?? "").trim() === userId);
  if (rowIndex === -1) {
    return { status: "not_found" };
  }
  const rowNumber = rowIndex + 2;
  const parsed = parseDayRow(rows[rowIndex] as string[], dayConfig);

  if (parsed.checkedIn) {
    return { status: "already", checkedInAt: parsed.checkedInAt ?? "", selections: parsed.slots };
  }

  const chosenSlots = dayConfig.timeSlots.filter((slot) => selections[slot]);
  if (chosenSlots.length !== dayConfig.timeSlots.length) {
    return { status: "invalid_selection", message: "Pick one session for every time slot." };
  }
  const chosenEvents = dayConfig.timeSlots.map((slot) => selections[slot]);
  const uniqueEvents = new Set(chosenEvents);
  if (uniqueEvents.size !== dayConfig.timeSlots.length) {
    return { status: "invalid_selection", message: "Each time slot must have a different session." };
  }
  for (const event of chosenEvents) {
    if (!dayConfig.events.includes(event)) {
      return { status: "invalid_selection", message: "Invalid session selected." };
    }
  }

  const roster = await fetchDayRoster(dayConfig);
  const availability = computeAvailability(roster, day);
  for (const slot of dayConfig.timeSlots) {
    const event = selections[slot];
    const slotAvailability = availability.find((a) => a.slot === slot && a.event === event);
    if (slotAvailability?.full) {
      return { status: "slot_full", slot, event };
    }
  }

  const now = new Date().toISOString();
  const eventColumns = dayConfig.events.map((name) => (uniqueEvents.has(name) ? "YES" : "NO"));
  const slotColumns = dayConfig.timeSlots.map((slot) => selections[slot]);
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${dayConfig.sheetName}!${colLetter(1)}${rowNumber}:${colLetter(cols.lastCol)}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[...eventColumns, String(chosenEvents.length), "TRUE", now, ...slotColumns]],
    },
  });
  rosterCache = null;
  return { status: "checked_in", checkedInAt: now, selections };
}

export function computeMetrics(roster: Attendee[], day: DayId): Metrics {
  const dayConfig = DAYS[day];
  const totalRegistered = roster.length;
  const totalCheckedIn = roster.filter((a) => a.checkedIn).length;

  const perEvent = dayConfig.events.map((event) => ({
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
