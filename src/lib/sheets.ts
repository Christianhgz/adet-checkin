import { google, sheets_v4 } from "googleapis";
import { allSeminars, CONFIG_SHEET_NAME, DAYS, DayConfig, DayId, USERS_SHEET_NAME } from "./days";

// Cache TTLs are deliberately uneven: data that essentially never changes
// (the user list) is cached far longer than data that changes constantly
// (per-day check-in status), to cut Google Sheets API call volume under
// heavy concurrent load without sacrificing correctness where it matters.
const USERS_CACHE_TTL_MS = 5 * 60_000;
const ROSTER_CACHE_TTL_MS = 15_000;

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

// Retries transient/rate-limit failures (429, 5xx) with exponential backoff
// + jitter. Under a burst of concurrent check-ins this is what keeps
// individual requests succeeding instead of failing outright when Google's
// per-minute quota is momentarily exceeded.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status =
        (err as { code?: number; response?: { status?: number } })?.response?.status ??
        (err as { code?: number })?.code;
      const retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
      if (!retryable || i === attempts - 1) throw err;
      const delay = 250 * 2 ** i + Math.random() * 250;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
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
// A: user-id | B..: one column per distinct seminar (across all sessions) |
// then total-events, checked-in, checked-in-at | then one column per session.
function dayColumns(day: DayConfig) {
  const seminarCount = allSeminars(day).length;
  const eventsStart = 1;
  const totalEventsCol = eventsStart + seminarCount;
  const checkedInCol = totalEventsCol + 1;
  const checkedInAtCol = checkedInCol + 1;
  const slotsStart = checkedInAtCol + 1;
  const lastCol = slotsStart + day.sessions.length - 1;
  return { eventsStart, totalEventsCol, checkedInCol, checkedInAtCol, slotsStart, lastCol };
}

// -------------------- active day config --------------------

// Deliberately uncached: this is a tiny, cheap read (a single cell), and
// caching it in-memory was the root cause of the switch feeling unreliable
// — Vercel runs multiple separate serverless instances concurrently, each
// with its own copy of any module-level cache, so a switch cleared only the
// one instance that handled it while every other warm instance kept
// answering with the old day for up to the cache's TTL. The public-facing
// routes that need protecting from high concurrent volume already get that
// protection from Vercel's edge cache (see the `revalidate` export on
// /api/day-config and /api/attendees), which sits in front of this function
// and isn't affected by removing this second, inconsistent layer.
export async function getActiveDay(): Promise<DayId> {
  const sheets = getClient();
  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${CONFIG_SHEET_NAME}!A2:B2`,
    }),
  );
  const value = (res.data.values?.[0]?.[1] ?? "").trim().toLowerCase();
  return value === "sunday" ? "sunday" : "saturday";
}

export async function setActiveDay(day: DayId): Promise<void> {
  const sheets = getClient();
  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${CONFIG_SHEET_NAME}!A2:B2`,
      valueInputOption: "RAW",
      requestBody: { values: [["active-day", day]] },
    }),
  );
  rosterCache = null;
}

// -------------------- users (identity, shared across days) --------------------

type UserRecord = { firstName: string; lastName: string; email: string };

let usersCache: { data: Map<string, UserRecord>; expiresAt: number } | null = null;

function parseUsers(rows: string[][]): Map<string, UserRecord> {
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
  return map;
}

async function getUsers(): Promise<Map<string, UserRecord>> {
  if (usersCache && usersCache.expiresAt > Date.now()) {
    return usersCache.data;
  }
  const sheets = getClient();
  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${USERS_SHEET_NAME}!A2:D1000`,
    }),
  );
  const map = parseUsers((res.data.values ?? []) as string[][]);
  usersCache = { data: map, expiresAt: Date.now() + USERS_CACHE_TTL_MS };
  return map;
}

// -------------------- day roster (per-day check-in data, joined with users) --------------------

type ParsedDayRow = Omit<Attendee, "firstName" | "lastName" | "email">;

function parseDayRow(row: string[], day: DayConfig): ParsedDayRow {
  const cols = dayColumns(day);
  const seminars = allSeminars(day);
  const userId = (row[0] ?? "").trim();
  const eventCells = row.slice(cols.eventsStart, cols.eventsStart + seminars.length);
  const totalEvents = (row[cols.totalEventsCol] ?? "").trim();
  const checkedIn = (row[cols.checkedInCol] ?? "").trim().toUpperCase() === "TRUE";
  const checkedInAt = (row[cols.checkedInAtCol] ?? "").trim() || null;
  const slotCells = row.slice(cols.slotsStart, cols.slotsStart + day.sessions.length);

  const events = seminars.filter((_, i) => (eventCells[i] ?? "").trim().toUpperCase() === "YES");
  const slots: Record<string, string> = {};
  day.sessions.forEach((session, i) => {
    const value = (slotCells[i] ?? "").trim();
    if (session.options.some((o) => o.name === value)) {
      slots[session.slot] = value;
    }
  });

  return { userId, events, totalEvents, checkedIn, checkedInAt, slots };
}

function joinWithUsers(rows: ParsedDayRow[], users: Map<string, UserRecord>): Attendee[] {
  return rows
    .filter((r) => r.userId)
    .map((r) => {
      const user = users.get(r.userId) ?? { firstName: "", lastName: "", email: "" };
      return { ...r, ...user };
    })
    .filter((a) => a.firstName || a.lastName);
}

let rosterCache: { day: DayId; data: Attendee[]; expiresAt: number } | null = null;

async function fetchDayRoster(day: DayConfig): Promise<Attendee[]> {
  const sheets = getClient();
  const cols = dayColumns(day);
  const dayRange = `${day.sheetName}!A2:${colLetter(cols.lastCol)}1000`;
  const usersRange = `${USERS_SHEET_NAME}!A2:D1000`;

  // One batchGet instead of two separate requests: Google counts this as a
  // single API call against the read-request quota regardless of how many
  // ranges are included, which matters a lot once dozens of devices are
  // hitting this concurrently.
  const needUsers = !usersCache || usersCache.expiresAt <= Date.now();
  const ranges = needUsers ? [dayRange, usersRange] : [dayRange];
  const res = await withRetry(() =>
    sheets.spreadsheets.values.batchGet({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      ranges,
    }),
  );

  const dayRows = (res.data.valueRanges?.[0]?.values ?? []) as string[][];
  if (needUsers) {
    const usersRows = (res.data.valueRanges?.[1]?.values ?? []) as string[][];
    usersCache = { data: parseUsers(usersRows), expiresAt: Date.now() + USERS_CACHE_TTL_MS };
  }
  const users = usersCache!.data;

  const parsed = dayRows.map((row) => parseDayRow(row, day));
  return joinWithUsers(parsed, users);
}

// Cached (up to 15s stale, per-instance) — used only by the public,
// high-concurrency check-in path where that's a deliberate, worthwhile
// tradeoff. Admin routes must not use this; see getRosterFresh below.
export async function getRoster(day: DayId): Promise<Attendee[]> {
  if (rosterCache && rosterCache.day === day && rosterCache.expiresAt > Date.now()) {
    return rosterCache.data;
  }
  const data = await fetchDayRoster(DAYS[day]);
  rosterCache = { day, data, expiresAt: Date.now() + ROSTER_CACHE_TTL_MS };
  return data;
}

// Always-fresh roster read, bypassing the in-memory cache entirely. There's
// only ever one (or a couple of) admin dashboard sessions polling this, so
// the extra Sheets API calls are negligible — and correctness (never
// showing stale counts right after a day switch) matters far more here
// than for the public path.
export async function getRosterFresh(day: DayId): Promise<Attendee[]> {
  return fetchDayRoster(DAYS[day]);
}

// Always-fresh, single-attendee lookup that bypasses both the in-memory
// roster cache and (by not living behind a `revalidate`-cached route) the
// edge cache. Used right before showing someone the check-in modal, so a
// person who just checked in never sees a stale "not checked in" state from
// the cached bulk roster used for search.
export async function getFreshAttendeeStatus(day: DayId, userId: string): Promise<Attendee | null> {
  const roster = await fetchDayRoster(DAYS[day]);
  return roster.find((a) => a.userId === userId) ?? null;
}

export function computeAvailability(
  roster: Pick<Attendee, "checkedIn" | "slots">[],
  day: DayId,
): SlotAvailability[] {
  const dayConfig = DAYS[day];
  const availability: SlotAvailability[] = [];
  for (const session of dayConfig.sessions) {
    for (const option of session.options) {
      const taken = roster.filter((a) => a.checkedIn && a.slots[session.slot] === option.name).length;
      availability.push({
        slot: session.slot,
        event: option.name,
        location: option.location,
        capacity: option.capacity,
        taken,
        full: taken >= option.capacity,
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
  const seminars = allSeminars(dayConfig);
  const sheets = getClient();

  // Single fresh (uncached) read of the whole day tab: gives us this user's
  // row (for the already-checked-in check) AND every other row (for an
  // accurate capacity count) from one API call, right before writing, to
  // minimize the race window without paying for a second read.
  const range = `${dayConfig.sheetName}!A2:${colLetter(cols.lastCol)}1000`;
  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range,
    }),
  );
  const rows = (res.data.values ?? []) as string[][];
  const rowIndex = rows.findIndex((r) => (r[0] ?? "").trim() === userId);
  if (rowIndex === -1) {
    return { status: "not_found" };
  }
  const rowNumber = rowIndex + 2;
  const allParsed = rows.map((r) => parseDayRow(r, dayConfig));
  const parsed = allParsed[rowIndex];

  if (parsed.checkedIn) {
    return { status: "already", checkedInAt: parsed.checkedInAt ?? "", selections: parsed.slots };
  }

  // Validate each session: required sessions must have a pick, optional
  // sessions may be skipped, and any pick must belong to that session's own
  // option list.
  for (const session of dayConfig.sessions) {
    const picked = selections[session.slot];
    if (!picked) {
      if (session.required) {
        return { status: "invalid_selection", message: `Pick a session for ${session.slot}.` };
      }
      continue;
    }
    if (!session.options.some((o) => o.name === picked)) {
      return { status: "invalid_selection", message: "Invalid session selected." };
    }
  }

  const chosenPairs = dayConfig.sessions
    .map((session) => ({ slot: session.slot, event: selections[session.slot] }))
    .filter((p): p is { slot: string; event: string } => Boolean(p.event));

  const uniqueEvents = new Set(chosenPairs.map((p) => p.event));
  if (uniqueEvents.size !== chosenPairs.length) {
    return { status: "invalid_selection", message: "Each session must have a different seminar." };
  }

  const availability = computeAvailability(allParsed, day);
  for (const { slot, event } of chosenPairs) {
    const slotAvailability = availability.find((a) => a.slot === slot && a.event === event);
    if (slotAvailability?.full) {
      return { status: "slot_full", slot, event };
    }
  }

  const now = new Date().toISOString();
  const eventColumns = seminars.map((name) => (uniqueEvents.has(name) ? "YES" : "NO"));
  const slotColumns = dayConfig.sessions.map((session) => selections[session.slot] ?? "");
  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${dayConfig.sheetName}!${colLetter(1)}${rowNumber}:${colLetter(cols.lastCol)}${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[...eventColumns, String(chosenPairs.length), "TRUE", now, ...slotColumns]],
      },
    }),
  );
  rosterCache = null;
  return {
    status: "checked_in",
    checkedInAt: now,
    selections: Object.fromEntries(chosenPairs.map((p) => [p.slot, p.event])),
  };
}

export function computeMetrics(roster: Attendee[], day: DayId): Metrics {
  const dayConfig = DAYS[day];
  const totalRegistered = roster.length;
  const totalCheckedIn = roster.filter((a) => a.checkedIn).length;

  const perEvent = allSeminars(dayConfig).map((event) => ({
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
